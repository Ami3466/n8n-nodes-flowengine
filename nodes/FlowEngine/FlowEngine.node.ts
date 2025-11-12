import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class FlowEngine implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'FlowEngine',
    name: 'flowEngine',
    icon: 'file:flowengine.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: 'Interact with FlowEngine AI to create and manage workflows',
    defaults: {
      name: 'FlowEngine',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'flowEngineApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Send Message',
            value: 'sendMessage',
            description: 'Send a message to FlowEngine AI',
            action: 'Send a message to FlowEngine AI',
          },
        ],
        default: 'sendMessage',
      },
      {
        displayName: 'Message',
        name: 'message',
        type: 'string',
        typeOptions: {
          rows: 4,
        },
        default: '',
        required: true,
        description: 'The message to send to FlowEngine AI',
        displayOptions: {
          show: {
            operation: ['sendMessage'],
          },
        },
      },
      {
        displayName: 'Model',
        name: 'model',
        type: 'options',
        options: [
          {
            name: 'Regular',
            value: 'regular',
            description: 'Standard AI model (faster, lower cost)',
          },
          {
            name: 'Boost',
            value: 'boost',
            description: 'More powerful AI model (slower, higher cost)',
          },
        ],
        default: 'regular',
        description: 'Choose which AI model to use',
        displayOptions: {
          show: {
            operation: ['sendMessage'],
          },
        },
      },
      {
        displayName: 'Additional Fields',
        name: 'additionalFields',
        type: 'collection',
        placeholder: 'Add Field',
        default: {},
        displayOptions: {
          show: {
            operation: ['sendMessage'],
          },
        },
        options: [
          {
            displayName: 'Conversation ID',
            name: 'conversationId',
            type: 'string',
            default: '',
            description: 'Optional conversation ID to continue an existing conversation',
          },
        ],
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const operation = this.getNodeParameter('operation', 0);

    for (let i = 0; i < items.length; i++) {
      try {
        if (operation === 'sendMessage') {
          const message = this.getNodeParameter('message', i) as string;
          const model = this.getNodeParameter('model', i) as string;
          const additionalFields = this.getNodeParameter('additionalFields', i) as {
            conversationId?: string;
          };

          const body: any = {
            message,
          };

          if (model && model !== 'regular') {
            body.model = model;
          }

          if (additionalFields.conversationId) {
            body.conversation_id = additionalFields.conversationId;
          }

          const response = await this.helpers.requestWithAuthentication.call(
            this,
            'flowEngineApi',
            {
              method: 'POST',
              url: 'https://flowengine.cloud/api/v1/chat',
              body,
              json: true,
            },
          );

          if (response.success) {
            returnData.push({
              json: {
                success: true,
                response: response.response,
                conversation_id: response.conversation_id,
                credits_remaining: response.credits_remaining,
              },
              pairedItem: i,
            });
          } else {
            throw new NodeOperationError(
              this.getNode(),
              `FlowEngine API error: ${response.error || 'Unknown error'}`,
              { itemIndex: i },
            );
          }
        }
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            },
            pairedItem: i,
          });
          continue;
        }
        throw error;
      }
    }

    return [returnData];
  }
}
