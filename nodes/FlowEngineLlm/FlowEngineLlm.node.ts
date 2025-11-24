import { ChatOpenAI, type ClientOptions } from '@langchain/openai';
import {
	type INodeType,
	type INodeTypeDescription,
	type ISupplyDataFunctions,
	type SupplyData,
} from 'n8n-workflow';

export class FlowEngineLlm implements INodeType {
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
				displayName: 'This node is only available for FlowEngine-hosted n8n instances. Visit app.flowengine.cloud to get a hosted instance with access to 100+ AI models via LiteLLM.',
				name: 'notice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Model',
				name: 'model',
				type: 'string',
				default: '',
				required: true,
				description: 'The AI model to use (e.g., gpt-4, claude-3-5-sonnet-20241022, gemini-pro)',
				placeholder: 'gpt-4',
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
		const apiKey = process.env.FLOWENGINE_LLM_API_KEY;

		if (!apiKey) {
			throw new Error(
				'FlowEngine LLM is only available for FlowEngine-hosted n8n instances. ' +
				'Visit app.flowengine.cloud to get a hosted instance with this feature.',
			);
		}

		const modelName = this.getNodeParameter('model', itemIndex) as string;

		const options = this.getNodeParameter('options', itemIndex, {}) as {
			frequencyPenalty?: number;
			maxTokens?: number;
			maxRetries?: number;
			timeout?: number;
			presencePenalty?: number;
			temperature?: number;
			topP?: number;
		};

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
