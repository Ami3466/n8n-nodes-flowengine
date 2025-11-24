import { ChatOpenAI, type ClientOptions } from '@langchain/openai';
import {
	NodeConnectionTypes,
	type INodeType,
	type INodeTypeDescription,
	type ISupplyDataFunctions,
	type SupplyData,
	type ILoadOptionsFunctions,
	type INodePropertyOptions,
} from 'n8n-workflow';

export class FlowEngineLlm implements INodeType {
	methods = {
		loadOptions: {
			async getProviders(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				// Try to get API key from credentials first, then fall back to environment variable
				let apiKey = process.env.FLOWENGINE_LLM_API_KEY;

				try {
					const credentials = await this.getCredentials('flowEngineLlmApi');
					if (credentials?.apiKey) {
						apiKey = credentials.apiKey as string;
					}
				} catch (error) {
					// Credentials not set, use environment variable
				}

				if (!apiKey) {
					return [{
						name: 'API Key Required',
						value: '',
						description: 'Set up FlowEngine LLM API credentials for testing or use FlowEngine-hosted instance',
					}];
				}

				try {
					const response = await this.helpers.request({
						method: 'GET',
						url: 'https://litellm.flowengine.cloud/model/info',
						headers: { 'Authorization': `Bearer ${apiKey}` },
						json: true,
					});

					if (response.data && Array.isArray(response.data)) {
						// Extract unique providers
						const providers = new Set<string>();
						response.data.forEach((model: any) => {
							const provider = model.model_info?.litellm_provider;
							if (provider) {
								providers.add(provider);
							}
						});

						const providerOptions = Array.from(providers)
							.sort()
							.map(provider => ({
								name: provider.charAt(0).toUpperCase() + provider.slice(1),
								value: provider,
							}));

						// Add "All Providers" option at the top
						return [
							{ name: 'All Providers', value: 'all' },
							...providerOptions,
						];
					}
				} catch (error) {
					console.error('Error fetching providers:', error);
				}

				return [{ name: 'All Providers', value: 'all' }];
			},

			async getModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				// Try to get API key from credentials first, then fall back to environment variable
				let apiKey = process.env.FLOWENGINE_LLM_API_KEY;

				try {
					const credentials = await this.getCredentials('flowEngineLlmApi');
					if (credentials?.apiKey) {
						apiKey = credentials.apiKey as string;
					}
				} catch (error) {
					// Credentials not set, use environment variable
				}

				if (!apiKey) {
					return [{
						name: 'API Key Required',
						value: '',
						description: 'Set up FlowEngine LLM API credentials for testing or use FlowEngine-hosted instance',
					}];
				}

				const provider = this.getCurrentNodeParameter('provider') as string;

				try {
					const response = await this.helpers.request({
						method: 'GET',
						url: 'https://litellm.flowengine.cloud/model/info',
						headers: { 'Authorization': `Bearer ${apiKey}` },
						json: true,
					});

					if (response.data && Array.isArray(response.data)) {
						// Filter by provider if not "all"
						let models = response.data;
						if (provider && provider !== 'all') {
							models = models.filter((model: any) =>
								model.model_info?.litellm_provider === provider
							);
						}

						return models
							.filter((model: any) => model.model_name)
							.map((model: any) => ({
								name: model.model_name,
								value: model.model_name,
								description: model.model_info?.litellm_provider
									? `Provider: ${model.model_info.litellm_provider}`
									: undefined,
							}))
							.sort((a: INodePropertyOptions, b: INodePropertyOptions) =>
								(a.name as string).localeCompare(b.name as string)
							);
					}
				} catch (error) {
					console.error('Error fetching models:', error);
				}

				return [{
					name: 'Error loading models',
					value: '',
					description: 'Failed to fetch available models from FlowEngine LLM',
				}];
			},
		},
	};

	description: INodeTypeDescription = {
		displayName: 'FlowEngine LLM Chat Model',
		name: 'flowEngineLlm',
		icon: 'file:flowengine.svg',
		group: ['transform'],
		version: 1,
		description: 'Access multiple AI models via FlowEngine LLM (FlowEngine-hosted instances only)',
		defaults: {
			name: 'FlowEngine LLM Chat Model',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Language Models'],
			},
		},
		inputs: [],
		outputs: [NodeConnectionTypes.AiLanguageModel],
		outputNames: ['Model'],
		credentials: [
			{
				name: 'flowEngineLlmApi',
				required: false,
				displayOptions: {
					show: {
						'@version': [1],
					},
				},
			},
		],
		properties: [
			{
				displayName: 'This node works automatically on FlowEngine-hosted n8n instances (pre-configured, no credentials needed). Contact support@flowengine.cloud if you are hosting with FlowEngine and it\'s not working.',
				name: 'notice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Provider',
				name: 'provider',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getProviders',
				},
				default: 'all',
				description: 'Filter models by provider',
			},
			{
				displayName: 'Model',
				name: 'model',
				type: 'options',
				typeOptions: {
					loadOptionsDependsOn: ['provider'],
					loadOptionsMethod: 'getModels',
				},
				default: '',
				required: true,
				description: 'The AI model to use',
			},
			{
				displayName: 'Options',
				name: 'options',
				placeholder: 'Add Option',
				description: 'Additional options to add',
				type: 'collection',
				default: {},
				options: [
					{
						displayName: 'Maximum Number of Tokens',
						name: 'maxTokens',
						default: -1,
						description:
							'The maximum number of tokens to generate in the completion',
						type: 'number',
						typeOptions: {
							maxValue: 32768,
						},
					},
					{
						displayName: 'Sampling Temperature',
						name: 'temperature',
						default: 0.7,
						typeOptions: { maxValue: 2, minValue: 0, numberPrecision: 1 },
						description:
							'Controls randomness: Lowering results in less random completions. As the temperature approaches zero, the model will become deterministic and repetitive.',
						type: 'number',
					},
					{
						displayName: 'Top P',
						name: 'topP',
						default: 1,
						typeOptions: { maxValue: 1, minValue: 0, numberPrecision: 1 },
						description:
							'Controls diversity via nucleus sampling: 0.5 means half of all likelihood-weighted options are considered',
						type: 'number',
					},
					{
						displayName: 'Timeout',
						name: 'timeout',
						default: 60000,
						description: 'Maximum amount of time a request is allowed to take in milliseconds',
						type: 'number',
					},
					{
						displayName: 'Max Retries',
						name: 'maxRetries',
						default: 2,
						description: 'Maximum number of retries to attempt',
						type: 'number',
					},
				],
			},
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const modelName = this.getNodeParameter('model', itemIndex) as string;

		const options = this.getNodeParameter('options', itemIndex, {}) as {
			maxTokens?: number;
			maxRetries?: number;
			timeout?: number;
			temperature?: number;
			topP?: number;
		};

		// Try to get API key from credentials first, then fall back to environment variable
		let apiKey = process.env.FLOWENGINE_LLM_API_KEY;

		try {
			const credentials = await this.getCredentials('flowEngineLlmApi');
			if (credentials?.apiKey) {
				apiKey = credentials.apiKey as string;
			}
		} catch (error) {
			// Credentials not set, use environment variable
		}

		if (!apiKey) {
			throw new Error(
				'FlowEngine LLM is only available for FlowEngine-hosted n8n instances. ' +
				'Visit app.flowengine.cloud to get a hosted instance with this feature. ' +
				'For testing, set up FlowEngine LLM API credentials in Settings > Credentials.',
			);
		}

		const configuration: ClientOptions = {
			baseURL: 'https://litellm.flowengine.cloud',
			defaultHeaders: {
				'HTTP-Referer': 'https://flowengine.cloud',
				'X-Title': 'FlowEngine n8n',
			},
		};

		// Only include universal parameters that work across all providers
		const modelOptions: any = {
			apiKey: apiKey,
			model: modelName,
			timeout: options.timeout ?? 60000,
			maxRetries: options.maxRetries ?? 2,
			configuration,
		};

		// Add universal parameters
		if (options.temperature !== undefined) {
			modelOptions.temperature = options.temperature;
		}
		if (options.maxTokens !== undefined && options.maxTokens !== -1) {
			modelOptions.maxTokens = options.maxTokens;
		}
		if (options.topP !== undefined) {
			modelOptions.topP = options.topP;
		}

		const model = new ChatOpenAI(modelOptions);

		return {
			response: model,
		};
	}
}
