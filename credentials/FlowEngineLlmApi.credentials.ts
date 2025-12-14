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
			displayName: 'If you\'re hosting with FlowEngine - no need to add any API key, it works automatically!',
			name: 'notice',
			type: 'notice',
			default: '',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description: 'Get your API key at <a href="https://flowengine.cloud/settings" target="_blank">flowengine.cloud/settings</a>',
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
