import datetime as dt
import decimal
import json
import os
import unittest
import types
from unittest.mock import MagicMock, patch
import lambda_function as api

DRAFT = '71111111-1111-4111-8111-111111111111'

def event(body=None, method='PATCH', path=None):
    return {'requestContext': {'http': {'method': method}}, 'rawPath': path or '/api/inspections/' + DRAFT,
            'headers': {'X-Operator-Id': 'op-1', 'Origin': 'http://localhost:5173'}, 'body': json.dumps(body or {})}

class ValidationTests(unittest.TestCase):
    def test_default_connection_matches_working_lambda(self):
        driver = types.ModuleType('pg8000.dbapi')
        driver.connect = MagicMock()
        package = types.ModuleType('pg8000')
        package.dbapi = driver
        env = {'DB_HOST': 'example.invalid', 'DB_PORT': '5432', 'DB_USER': 'test',
               'DB_PASSWORD': 'test-secret', 'DB_NAME': 'test-db'}
        with patch.dict(os.environ, env, clear=True), patch.dict('sys.modules', {'pg8000': package, 'pg8000.dbapi': driver}):
            api.connect()
        driver.connect.assert_called_once_with(host='example.invalid', port=5432, user='test',
                                              password='test-secret', database='test-db', timeout=15)

    def test_connection_timeout_is_identified_without_exposing_messages(self):
        error = RuntimeError('host=private password=secret')
        error.__cause__ = TimeoutError('sensitive endpoint')
        diagnostic = api.error_diagnostic(error, 'db_connect')
        self.assertEqual(diagnostic['code'], 'NETWORK_TIMEOUT')
        self.assertEqual(diagnostic['stage'], 'db_connect')
        self.assertNotIn('secret', json.dumps(diagnostic))
        self.assertNotIn('endpoint', json.dumps(diagnostic))

    def test_sqlstate_is_preserved_without_query_details(self):
        diagnostic = api.error_diagnostic(RuntimeError({'C': '42501', 'M': 'private query'}), 'db_operation')
        self.assertEqual(diagnostic['sqlstate'], '42501')
        self.assertEqual(diagnostic['code'], 'DATABASE_ERROR')
        self.assertNotIn('private query', json.dumps(diagnostic))

    def test_false_and_zero_are_answers(self):
        for value in [None, '  ', [], ['Nivel 1', '']]: self.assertTrue(api.empty(value))
        for value in [False, 0, '0']: self.assertFalse(api.empty(value))
        self.assertIsNone(api.normalise('nombreRiesgo', ' '))
        self.assertIs(api.normalise('disenoAntisismico', False), False)
        self.assertEqual(api.normalise('empleados', '0'), 0)

    def test_invalid_types_are_rejected(self):
        for field, value in [('empleados', '1.2'), ('empleados', True), ('disenoAntisismico', 'false'),
                             ('fechaInspeccion', '2026-02-30'), ('edificacionRD', 'NaN')]:
            with self.subTest(field=field), self.assertRaises(api.ApiError) as failure: api.normalise(field, value)
            self.assertEqual(failure.exception.status, 422)

    def test_roundtrip_types_and_omitted_fields(self):
        data = api.valid_fields({'nombreRiesgo': ' Mi riesgo ', 'fechaInspeccion': '2026-10-08'})
        self.assertEqual(data['nombreRiesgo'], 'Mi riesgo')
        self.assertEqual(data['fechaInspeccion'], dt.date(2026, 10, 8))
        self.assertNotIn('propietario', data)
        self.assertEqual(api.normalise('edificacionRD', '123.45'), decimal.Decimal('123.45'))

    def test_large_amounts_survive_json_without_rounding(self):
        value = api.json_value('{"edificacion_rd":9999999999999999.99}')
        self.assertEqual(value['edificacion_rd'], decimal.Decimal('9999999999999999.99'))
        self.assertEqual(json.loads(json.dumps(value, default=api.encode))['edificacion_rd'], '9999999999999999.99')

    def test_section_isolation_and_unknown_fields(self):
        with self.assertRaises(api.ApiError): api.valid_fields({'edificacionRD': 1}, '1')
        with self.assertRaises(api.ApiError): api.valid_fields({'operador_id': 'otro'})

    def test_photos_reuse_ids_and_reject_duplicates(self):
        photos = {c: [] for c in api.CATEGORIES}; photos['techos'] = [{'id': DRAFT}]
        self.assertEqual(api.valid_photos(photos)['techos'], [{'id': DRAFT}])
        photos['pisos'] = [{'id': DRAFT}]
        with self.assertRaises(api.ApiError): api.valid_photos(photos)
        with self.assertRaises(api.ApiError): api.valid_photos({'techos': []})

    def test_test_identity_is_opt_in_and_verified_identity_wins(self):
        with patch.dict(os.environ, {'ALLOW_TEST_OPERATOR': 'false'}):
            with self.assertRaises(api.ApiError): api.operator(event(), {'x-operator-id': 'fake'})
            secured = event(); secured['requestContext']['authorizer'] = {'jwt': {'claims': {'sub': 'verified'}}}
            self.assertEqual(api.operator(secured, {'x-operator-id': 'fake'}), 'verified')

class TransactionTests(unittest.TestCase):
    def setUp(self):
        self.connection = MagicMock(); self.cursor = self.connection.cursor.return_value
        self.cursor.fetchone.return_value = None
        for p in [patch.dict(os.environ, {'ALLOW_TEST_OPERATOR': 'true'}), patch.object(api, 'connect', return_value=self.connection)]:
            p.start(); self.addCleanup(p.stop)

    def test_stale_version_does_not_write(self):
        with patch.object(api, 'load_inspection', return_value=(DRAFT, 2)), patch.object(api, 'store_fields') as save:
            result = api.lambda_handler(event({'expectedVersion': 1, 'fields': {'nombreRiesgo': 'Risk'}}), None)
        self.assertEqual(result['statusCode'], 409); save.assert_not_called()
        self.connection.commit.assert_not_called(); self.connection.rollback.assert_called_once()

    def test_sql_failure_rolls_back_without_leaking_secrets(self):
        with patch.object(api, 'load_inspection', return_value=(DRAFT, 1)), patch.object(api, 'store_fields', side_effect=RuntimeError('secret-password')):
            result = api.lambda_handler(event({'expectedVersion': 1, 'fields': {'nombreRiesgo': 'Risk'}}), None)
        self.assertEqual(result['statusCode'], 503); self.assertNotIn('secret-password', result['body'])
        self.connection.commit.assert_not_called(); self.connection.rollback.assert_called_once()
        self.connection.close.assert_called_once()

    def test_partial_save_commits_and_does_not_upload_data_to_dana(self):
        with patch.object(api, 'load_inspection', return_value=(DRAFT, 1)), patch.object(api, 'store_fields') as store, \
             patch.object(api, 'validate_sections'), patch.object(api, 'document', return_value={'id': DRAFT, 'version': 2, 'ready': False}), \
             patch.object(api, 'upload_to_dana') as upload:
            result = api.lambda_handler(event({'expectedVersion': 1, 'fields': {'nombreRiesgo': 'Risk'}}), None)
        self.assertEqual(result['statusCode'], 200); self.assertTrue(json.loads(result['body'])['saved'])
        store.assert_called_once_with(self.cursor, DRAFT, {'nombreRiesgo': 'Risk'}); upload.assert_not_called()
        self.connection.commit.assert_called_once(); self.connection.rollback.assert_not_called()

    def test_other_operators_draft_is_not_written(self):
        with patch.object(api, 'load_inspection', side_effect=api.ApiError(404, 'No encontrado')), patch.object(api, 'store_fields') as store:
            result = api.lambda_handler(event({'expectedVersion': 1, 'fields': {}}), None)
        self.assertEqual(result['statusCode'], 404); store.assert_not_called()

    def test_frozen_draft_cannot_be_edited(self):
        self.cursor.fetchone.return_value = (DRAFT,)
        with patch.object(api, 'load_inspection', return_value=(DRAFT, 1)), patch.object(api, 'store_fields') as store:
            result = api.lambda_handler(event({'expectedVersion': 1, 'fields': {}}), None)
        self.assertEqual(result['statusCode'], 409); store.assert_not_called()

    def test_photo_failure_rolls_back_same_save(self):
        with patch.object(api, 'load_inspection', return_value=(DRAFT, 1)), patch.object(api, 'store_fields'), \
             patch.object(api, 'store_photos', side_effect=api.ApiError(502, 'Fileupload falló')):
            result = api.lambda_handler(event({'expectedVersion': 1, 'fields': {'nombreRiesgo': 'Risk'}}), None)
        self.assertEqual(result['statusCode'], 502); self.connection.commit.assert_not_called()
        self.connection.rollback.assert_called_once()

    def test_noop_does_not_fire_insert_triggers(self):
        self.cursor.fetchone.return_value = ('Risk',)
        api.store_fields(self.cursor, DRAFT, {'nombreRiesgo': 'Risk'})
        self.assertFalse(any('INSERT' in c.args[0] or 'UPDATE' in c.args[0] for c in self.cursor.execute.call_args_list))

    def test_creation_returns_real_id_and_commits(self):
        self.cursor.fetchone.return_value = (DRAFT,)
        with patch.object(api, 'document', return_value={'id': DRAFT, 'version': 0}):
            result = api.lambda_handler(event(method='POST', path='/api/inspections'), None)
        self.assertEqual(result['statusCode'], 201); self.assertEqual(json.loads(result['body'])['id'], DRAFT)
        self.connection.commit.assert_called_once()

    def test_bad_base64_is_client_error(self):
        request = event(); request.update({'body': '%%%', 'isBase64Encoded': True})
        self.assertEqual(api.lambda_handler(request, None)['statusCode'], 400)

class DanaTests(unittest.TestCase):
    def test_json_and_xml_file_ids(self):
        photo = {'name': 'a.jpg', 'content': b'image', 'mime': 'image/jpeg'}
        with patch.dict(os.environ, {'DANA_USER': 'api', 'DANA_PASSWORD': 'private', 'DANA_EMPRESA': 'test'}):
            for text in [b'{"wsResult":{"fileID":"abc"}}', b'<fileID>abc</fileID>']:
                result = MagicMock(); result.__enter__.return_value.read.return_value = text
                with patch.object(api.urllib.request, 'urlopen', return_value=result):
                    self.assertEqual(api.upload_to_dana(photo), 'abc')

    def test_http_200_without_file_id_is_failure(self):
        result = MagicMock(); result.__enter__.return_value.read.return_value = b'{"ok":true}'
        with patch.dict(os.environ, {'DANA_USER': 'api', 'DANA_PASSWORD': 'private', 'DANA_EMPRESA': 'test'}), \
             patch.object(api.urllib.request, 'urlopen', return_value=result), self.assertRaises(api.ApiError):
            api.upload_to_dana({'name': 'a.jpg', 'content': b'image', 'mime': 'image/jpeg'})

if __name__ == '__main__': unittest.main()
