import {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class FlowEngineApi implements ICredentialType {
  name = 'flowEngineApi';
  displayName = 'FlowEngine API';
  documentationUrl = 'https://flowengine.cloud/api-docs';
  properties: INodeProperties[] = [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description: 'Your FlowEngine API key. Get it from Settings > API Access at flowengine.cloud',
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: {
        Authorization: '=Bearer {{$credentials.apiKey}}',
      },
    },
  };

  test: ICredentialTestRequest = {
    request: {
      baseURL: 'https://flowengine.cloud',
      url: '/api/v1/chat',
      method: 'POST',
      body: {
        message: 'Test connection',
      },
    },
  };
}
