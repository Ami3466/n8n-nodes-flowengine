import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class FlowEngineLlmApi implements ICredentialType {
	name = 'flowEngineLlmApi';

	displayName = 'LiteLLM API (Testing Only)';

	documentationUrl = 'litellm';

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
				'⚠️ FOR TESTING ONLY - FlowEngine-hosted n8n instances have LiteLLM pre-configured automatically. Only use these credentials if testing with your own LiteLLM instance.',
		},
		{
			displayName: 'Master Key',
			name: 'masterKey',
			type: 'string',
			typeOptions: { password: true },
			required: false,
			default: '',
			description: 'LiteLLM master key (for admin operations like creating virtual keys)',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description: 'LiteLLM user/virtual key (for making API calls to models)',
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
