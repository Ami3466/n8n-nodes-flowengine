import { randomUUID } from 'crypto';
import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

export class AiSessionManager implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'FlowEngine Session ID',
		name: 'aiSessionManager',
		icon: 'file:flowengine.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["mode"]}}',
		description: 'Generates or manages Session IDs for AI Agents. The missing link for AI Agent setup.',
		defaults: {
			name: 'FlowEngine Session ID',
		},
		inputs: ['main'],
		outputs: ['main'],
		properties: [
			{
				displayName: 'Mode',
				name: 'mode',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Generate New ID',
						value: 'generateNew',
						description: 'Creates a fresh UUID v4 for each execution',
					},
					{
						name: 'Manage Loop Session',
						value: 'manageLoop',
						description: 'Persists one ID across multiple loop iterations using workflow static data',
					},
				],
				default: 'generateNew',
				description: 'Choose how to handle the Session ID generation',
			},
			{
				displayName: 'Session Key',
				name: 'sessionKey',
				type: 'string',
				default: 'aiAgentSession',
				required: true,
				displayOptions: {
					show: {
						mode: ['manageLoop'],
					},
				},
				description: 'The key used to store and retrieve the session ID from workflow static data',
				placeholder: 'e.g., myAgentSession',
			},
			{
				displayName: 'Reset Session',
				name: 'resetSession',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						mode: ['manageLoop'],
					},
				},
				description: 'Whether to force generate a new session ID, replacing any existing one',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const mode = this.getNodeParameter('mode', 0) as string;

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				let sessionId: string;

				if (mode === 'generateNew') {
					// Mode 1: Generate a fresh UUID for each item
					sessionId = randomUUID();
				} else if (mode === 'manageLoop') {
					// Mode 2: Persist session ID across loop iterations
					const sessionKey = this.getNodeParameter('sessionKey', itemIndex) as string;
					const resetSession = this.getNodeParameter('resetSession', itemIndex) as boolean;

					if (!sessionKey || sessionKey.trim() === '') {
						throw new NodeOperationError(
							this.getNode(),
							'Session Key cannot be empty when using Manage Loop Session mode',
							{ itemIndex },
						);
					}

					// Get workflow static data (persists across executions within the same workflow run)
					const staticData = this.getWorkflowStaticData('node');

					if (resetSession || !staticData[sessionKey]) {
						// Generate new ID if resetting or if no existing ID
						staticData[sessionKey] = randomUUID();
					}

					sessionId = staticData[sessionKey] as string;
				} else {
					throw new NodeOperationError(
						this.getNode(),
						`Unknown mode: ${mode}`,
						{ itemIndex },
					);
				}

				// Build output with the session ID
				const newItem: INodeExecutionData = {
					json: {
						sessionId,
					},
					pairedItem: {
						item: itemIndex,
					},
				};

				// Preserve binary data if present
				if (items[itemIndex].binary) {
					newItem.binary = items[itemIndex].binary;
				}

				returnData.push(newItem);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: (error as Error).message,
						},
						pairedItem: {
							item: itemIndex,
						},
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
