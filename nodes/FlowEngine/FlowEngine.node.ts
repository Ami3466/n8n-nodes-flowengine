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
        displayName: '<a href="https://flowengine.cloud/settings" target="_blank">Get your API key here</a>',
        name: 'notice',
        type: 'notice',
        default: '',
      },
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
            model: model || 'regular',
          };

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
              json: false,
              encoding: 'utf-8',
            },
          );

          // Parse SSE streaming response
          const responseText = typeof response === 'string' ? response : JSON.stringify(response);
          
          // Check for error response (non-streaming JSON)
          if (responseText.startsWith('{')) {
            try {
              const errorJson = JSON.parse(responseText);
              if (errorJson.success === false) {
                throw new NodeOperationError(
                  this.getNode(),
                  `FlowEngine API error: ${errorJson.error || errorJson.message || 'Unknown error'}`,
                  { itemIndex: i },
                );
              }
            } catch (parseError) {
              // Not a JSON error, continue with SSE parsing
            }
          }

          // Extract content from SSE chunks
          let fullContent = '';
          let conversationId = '';
          
          const lines = responseText.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ') && !line.includes('[DONE]')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.choices?.[0]?.delta?.content) {
                  fullContent += data.choices[0].delta.content;
                }
                if (data.conversation_id) {
                  conversationId = data.conversation_id;
                }
              } catch {
                // Skip unparseable lines
              }
            }
          }

          if (fullContent) {
            returnData.push({
              json: {
                success: true,
                response: fullContent,
                conversation_id: conversationId || body.conversation_id || '',
              },
              pairedItem: i,
            });
          } else {
            throw new NodeOperationError(
              this.getNode(),
              'FlowEngine API error: No response content received',
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
