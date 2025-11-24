import { ChatOpenAI, type ClientOptions } from '@langchain/openai';
import {
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
				const manualApiKey = this.getNodeParameter('options.apiKey', 0) as string | undefined;
				const apiKey = manualApiKey || process.env.FLOWENGINE_LLM_API_KEY;

				if (!apiKey) {
					return [{
						name: 'API Key Required',
						value: '',
						description: 'Add API key in Options > API Key (Advanced) or use FlowEngine-hosted instance',
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
				const manualApiKey = this.getNodeParameter('options.apiKey', 0) as string | undefined;
				const apiKey = manualApiKey || process.env.FLOWENGINE_LLM_API_KEY;

				if (!apiKey) {
					return [{
						name: 'API Key Required',
						value: '',
						description: 'Add API key in Options > API Key (Advanced) or use FlowEngine-hosted instance',
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
		outputs: [
			{
				type: 'ai_languageModel',
				displayName: 'Language Model',
			},
		],
		outputNames: ['Model'],
		credentials: [],
		properties: [
			{
				displayName: 'This node is only available for FlowEngine-hosted n8n instances. Visit app.flowengine.cloud to get a hosted instance with access to 100+ AI models.',
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
						displayName: 'API Key (Advanced)',
						name: 'apiKey',
						type: 'string',
						typeOptions: { password: true },
						default: '',
						description: 'Manually provide FlowEngine LLM API key (only use if environment variable is not set)',
					},
					{
						displayName: 'Frequency Penalty',
						name: 'frequencyPenalty',
						default: 0,
						typeOptions: { maxValue: 2, minValue: -2, numberPrecision: 1 },
						description:
							"Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim",
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
					{
						displayName: 'Presence Penalty',
						name: 'presencePenalty',
						default: 0,
						typeOptions: { maxValue: 2, minValue: -2, numberPrecision: 1 },
						description:
							"Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics",
						type: 'number',
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
					{
						displayName: 'Top P',
						name: 'topP',
						default: 1,
						typeOptions: { maxValue: 1, minValue: 0, numberPrecision: 1 },
						description:
							'Controls diversity via nucleus sampling: 0.5 means half of all likelihood-weighted options are considered',
						type: 'number',
					},
				],
			},
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const modelName = this.getNodeParameter('model', itemIndex) as string;

		const options = this.getNodeParameter('options', itemIndex, {}) as {
			apiKey?: string;
			frequencyPenalty?: number;
			maxTokens?: number;
			maxRetries?: number;
			timeout?: number;
			presencePenalty?: number;
			temperature?: number;
			topP?: number;
		};

		// Use manual API key if provided, otherwise use environment variable
		const apiKey = options.apiKey || process.env.FLOWENGINE_LLM_API_KEY;

		if (!apiKey) {
			throw new Error(
				'FlowEngine LLM is only available for FlowEngine-hosted n8n instances. ' +
				'Visit app.flowengine.cloud to get a hosted instance with this feature. ' +
				'Alternatively, add your API key in the Options > API Key (Advanced) field.',
			);
		}

		const configuration: ClientOptions = {
			baseURL: 'https://litellm.flowengine.cloud',
		};

		const model = new ChatOpenAI({
			apiKey: apiKey,
			model: modelName,
			...options,
			timeout: options.timeout ?? 60000,
			maxRetries: options.maxRetries ?? 2,
			configuration,
		});

		return {
			response: model,
		};
	}
}
