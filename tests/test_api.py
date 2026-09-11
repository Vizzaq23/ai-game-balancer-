import io
import json
from types import SimpleNamespace
from unittest.mock import MagicMock
import pytest
from api import create_app
from balancer.analysis import analyze
from balancer.demo import demo_records
from balancer.explanations import explain


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("ENABLE_LIVE_AI", "false")
    app = create_app()
    app.config["TESTING"] = True
    return app.test_client()


def test_health_demo_analysis(client):
    assert client.get('/health').json['data']['status'] == 'ok'
    demo = client.get('/api/v1/demo').json['data']
    assert demo['synthetic'] is True
    response = client.post('/api/v1/analyze', json={'data': demo['records']})
    assert response.status_code == 200
    assert response.json['errors'] == []
    assert response.json['data']['analysis']['summary']['records'] == 607
    assert response.headers['Cache-Control'] == 'no-store'


def test_multipart_and_filter(client):
    response = client.post('/api/v1/analyze', data={
        'file': (io.BytesIO(b'weapon,kills,deaths,team\nA,3,2,Red\nB,1,2,Blue'), 'test.csv'),
        'filters': json.dumps({'team': 'Red'}), 'tolerance': '0.25'})
    assert response.status_code == 200
    assert response.json['data']['analysis']['summary']['records'] == 1
    assert response.json['data']['analysis']['tolerance'] == .25


@pytest.mark.parametrize('payload', [[], {}, {'data': []}, {'data': [{'weapon': 'A', 'kills': -1, 'deaths': 1}]}])
def test_bad_payload_returns_actionable_error(client, payload):
    response = client.post('/api/v1/analyze', json=payload)
    assert response.status_code == 400
    assert response.json['data'] is None
    assert response.json['errors']


def test_malformed_json_and_csv(client):
    assert client.post('/api/v1/analyze', data='{bad', content_type='application/json').status_code == 400
    response = client.post('/api/v1/analyze', data={'file': (io.BytesIO(b'a,b\n1,2'), 'bad.csv')})
    assert response.status_code == 400
    assert 'Missing required columns' in response.json['errors'][0]
    assert client.get('/api/v1/unknown').status_code == 404


def test_oversize_request(client):
    response = client.post('/api/v1/analyze', data=b'x' * (32 * 1024 * 1024 + 1), content_type='application/json')
    assert response.status_code == 413
    assert '10 MB' in response.json['errors'][0]


def test_legacy_honors_tolerance_and_response_shape(client):
    low = client.post('/analyze', json={'data': demo_records(), 'tolerance': .1}).json
    high = client.post('/analyze', json={'data': demo_records(), 'tolerance': 5}).json
    assert isinstance(low, list)
    assert set(low[0]) == {'weapon', 'status', 'suggestion'}
    assert any(r['status'] == 'overpowered' for r in low)
    assert not any(r['status'] == 'overpowered' for r in high)


def test_explanations_disabled_and_missing_credentials(client, monkeypatch):
    response = client.post('/api/v1/explanations', json={'data': demo_records()})
    assert response.json['data']['source'] == 'built_in'
    monkeypatch.setenv('ENABLE_LIVE_AI', 'true')
    monkeypatch.delenv('OPENAI_API_KEY', raising=False)
    assert explain(analyze(demo_records()))['source'] == 'built_in'


def configure_ai(monkeypatch):
    monkeypatch.setenv('ENABLE_LIVE_AI', 'true')
    monkeypatch.setenv('OPENAI_API_KEY', 'unit-test-not-a-real-key')
    monkeypatch.setenv('OPENAI_MODEL', 'test-model')


def test_ai_uses_aggregate_evidence_only(monkeypatch):
    configure_ai(monkeypatch)
    mock_client = MagicMock()
    mock_client.responses.create.return_value = SimpleNamespace(output_text='Review Longbow in a controlled playtest.')
    monkeypatch.setattr('openai.OpenAI', lambda **kwargs: mock_client)
    result = explain(analyze(demo_records()))
    assert result['source'] == 'openai'
    call = mock_client.responses.create.call_args.kwargs
    evidence = json.loads(call['input'])
    assert 'player_id' not in call['input']
    assert set(evidence) == {'summary', 'weapons', 'tolerance', 'methodology'}
    assert call['store'] is False


@pytest.mark.parametrize('failure', ['timeout', 'empty'])
def test_ai_failure_preserves_built_in(monkeypatch, failure):
    configure_ai(monkeypatch)
    mock_client = MagicMock()
    if failure == 'timeout':
        mock_client.responses.create.side_effect = TimeoutError()
    else:
        mock_client.responses.create.return_value = SimpleNamespace(output_text='')
    monkeypatch.setattr('openai.OpenAI', lambda **kwargs: mock_client)
    result = explain(analyze(demo_records()))
    assert result['source'] == 'built_in'
    assert result['notice']


def test_live_ai_rate_limit(client, monkeypatch):
    monkeypatch.setenv('ENABLE_LIVE_AI', 'true')
    monkeypatch.setattr('api.explain', lambda result: {'source': 'openai', 'text': 'Mock explanation'})
    for _ in range(20):
        assert client.post('/api/v1/explanations', json={'data': demo_records()}).json['data']['source'] == 'openai'
    result = client.post('/api/v1/explanations', json={'data': demo_records()}).json['data']
    assert result['source'] == 'built_in'
    assert 'limit' in result['notice']
