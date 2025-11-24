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

// Custom ChatOpenAI class that removes OpenAI-specific parameters for multi-provider compatibility
class FlowEngineChatOpenAI extends ChatOpenAI {
	invocationParams(options?: any, extra?: any) {
		const params = super.invocationParams(options, extra);
		// Remove OpenAI-specific parameters that other providers don't support
		delete params.frequency_penalty;
		delete params.presence_penalty;
		delete params.top_p;
		return params;
	}
}

export class FlowEngineLlm implements INodeType {
	methods = {
		loadOptions: {
			async getProviders(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				// Try to get API key from credentials first, then fall back to environment variable
				let apiKey = process.env.FLOWENGINE_LLM_API_KEY;

				try {
					const credentials = await this.getCredentials('flowEngineApi');
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
						description: 'Set up FlowEngine API credentials or use FlowEngine-hosted instance',
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
							const provider = model.model_info?.provider || model.model_info?.litellm_provider;
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
					const credentials = await this.getCredentials('flowEngineApi');
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
						description: 'Set up FlowEngine API credentials or use FlowEngine-hosted instance',
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
							models = models.filter((model: any) => {
								const modelProvider = model.model_info?.provider || model.model_info?.litellm_provider;
								return modelProvider === provider;
							});
						}

						return models
							.filter((model: any) => model.model_name)
							.map((model: any) => {
								const modelProvider = model.model_info?.provider || model.model_info?.litellm_provider;
								return {
									name: model.model_name,
									value: model.model_name,
									description: modelProvider ? `Provider: ${modelProvider}` : undefined,
								};
							})
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
					description: 'Failed to fetch available models from FlowEngine',
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
		description: 'Access 100+ AI models (OpenAI, Anthropic, Google, Mistral, etc.) via FlowEngine',
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
				name: 'flowEngineApi',
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
				displayName: 'If you are hosting on FlowEngine, this node is automatically configured. If self-hosting, go to FlowEngine Settings to get your API key and add it to your FlowEngine API credentials.',
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
						displayName: 'Sampling Temperature',
						name: 'temperature',
						default: 0.7,
						typeOptions: { maxValue: 2, minValue: 0, numberPrecision: 1 },
						description:
							'Controls randomness: Lowering results in less random completions. As the temperature approaches zero, the model will become deterministic and repetitive.',
						type: 'number',
					},
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
				],
			},
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const modelName = this.getNodeParameter('model', itemIndex) as string;
		const options = this.getNodeParameter('options', itemIndex, {}) as {
			temperature?: number;
			maxTokens?: number;
		};

		// Try to get API key from credentials first, then fall back to environment variable
		let apiKey = process.env.FLOWENGINE_LLM_API_KEY;

		try {
			const credentials = await this.getCredentials('flowEngineApi');
			if (credentials?.apiKey) {
				apiKey = credentials.apiKey as string;
			}
		} catch (error) {
			// Credentials not set, use environment variable
		}

		if (!apiKey) {
			throw new Error(
				'FlowEngine API key required. If hosting on FlowEngine, this is auto-configured. ' +
				'If self-hosting, get your API key from FlowEngine Settings and add it to your FlowEngine API credentials.',
			);
		}

		const configuration: ClientOptions = {
			baseURL: 'https://litellm.flowengine.cloud',
			defaultHeaders: {
				'HTTP-Referer': 'https://flowengine.cloud',
				'X-Title': 'FlowEngine n8n',
			},
		};

		const modelOptions: any = {
			apiKey: apiKey,
			model: modelName,
			configuration,
		};

		// Add configured parameters
		if (options.temperature !== undefined) {
			modelOptions.temperature = options.temperature;
		}
		if (options.maxTokens !== undefined && options.maxTokens !== -1) {
			modelOptions.maxTokens = options.maxTokens;
		}

		const model = new FlowEngineChatOpenAI(modelOptions);

		// Delete OpenAI-specific parameters that other providers don't support
		// Similar to how n8n's Anthropic node handles unsupported parameters
		delete (model as any).frequencyPenalty;
		delete (model as any).presencePenalty;
		delete (model as any).topP;

		return {
			response: model,
		};
	}
}
