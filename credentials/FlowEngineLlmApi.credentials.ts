import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class FlowEngineLlmApi implements ICredentialType {
	name = 'flowEngineLlmApi';

	displayName = 'FlowEngine LLM API';

	documentationUrl = 'flowengine';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description: 'Your FlowEngine API key. Get it from FlowEngine Settings > API Access.',
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
			url: '/api/v1/litellm/models',
		},
	};
}
