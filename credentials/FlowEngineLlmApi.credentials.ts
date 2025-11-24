import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class FlowEngineLlmApi implements ICredentialType {
	name = 'flowEngineLlmApi';

	displayName = 'FlowEngine LLM API (Testing Only)';

	documentationUrl = 'flowengine';

	properties: INodeProperties[] = [
		{
			displayName: 'Notice',
			name: 'notice',
			type: 'notice',
			default: '',
			displayOptions: {
				show: {
					'@version': [1],
				},
			},
			// eslint-disable-next-line n8n-nodes-base/node-param-description-miscased-id
			description:
				'⚠️ These credentials are for testing purposes only. FlowEngine-hosted instances use pre-configured environment variables and do not require manual credential entry.',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description: 'Your FlowEngine LLM API key (user/virtual key for LiteLLM proxy)',
		},
		{
			displayName: 'Base URL',
			name: 'url',
			type: 'hidden',
			default: 'https://litellm.flowengine.cloud',
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
			baseURL: '={{ $credentials.url }}',
			url: '/v1/models',
		},
	};
}
