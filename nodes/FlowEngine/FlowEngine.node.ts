import {
  IExecuteFunctions,
  ILoadOptionsFunctions,
  INodeExecutionData,
  INodePropertyOptions,
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
          {
            name: 'FlowEngine LLM',
            value: 'flowEngineLlm',
            description: 'Access multiple AI models directly (FlowEngine-hosted instances only)',
            action: 'Use FlowEngine LLM for multi-model access',
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
      // FlowEngine LLM Operation Fields
      {
        displayName: 'Model',
        name: 'llmModel',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getAvailableModels',
        },
        default: '',
        description: 'Choose the AI model (dynamically loaded from your LiteLLM account)',
        displayOptions: {
          show: {
            operation: ['flowEngineLlm'],
          },
        },
      },
      {
        displayName: 'Message',
        name: 'llmMessage',
        type: 'string',
        typeOptions: {
          rows: 4,
        },
        default: '',
        required: true,
        description: 'The message/prompt to send to the AI model',
        displayOptions: {
          show: {
            operation: ['flowEngineLlm'],
          },
        },
      },
      {
        displayName: 'Temperature',
        name: 'temperature',
        type: 'number',
        typeOptions: {
          minValue: 0,
          maxValue: 2,
          numberPrecision: 1,
        },
        default: 0.7,
        description: 'Controls randomness: 0 is focused, 2 is very creative',
        displayOptions: {
          show: {
            operation: ['flowEngineLlm'],
          },
        },
      },
    ],
  };

  methods = {
    loadOptions: {
      async getAvailableModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const apiKey = process.env.FLOWENGINE_LLM_API_KEY;

        if (!apiKey) {
          return [{
            name: 'FlowEngine LLM not available',
            value: '',
            description: 'This feature is only available for FlowEngine-hosted n8n instances',
          }];
        }

        try {
          // Try /model/info first (provides detailed information)
          const response = await this.helpers.request({
            method: 'GET',
            url: 'https://litellm.flowengine.cloud/model/info',
            headers: { 'Authorization': `Bearer ${apiKey}` },
            json: true,
          });

          if (response.data && Array.isArray(response.data)) {
            return response.data
              .filter((model: any) => model.model_name || model.litellm_params?.model)
              .map((model: any) => ({
                name: model.model_name || model.litellm_params?.model,
                value: model.model_name || model.litellm_params?.model,
                description: model.model_info?.litellm_provider
                  ? `Provider: ${model.model_info.litellm_provider}`
                  : undefined,
              }));
          }
        } catch (error) {
          // Fallback to /v1/models endpoint
          try {
            const fallbackResponse = await this.helpers.request({
              method: 'GET',
              url: 'https://litellm.flowengine.cloud/v1/models',
              headers: { 'Authorization': `Bearer ${apiKey}` },
              json: true,
            });

            if (fallbackResponse.data && Array.isArray(fallbackResponse.data)) {
              return fallbackResponse.data
                .filter((model: any) => model.id)
                .map((model: any) => ({
                  name: model.id,
                  value: model.id,
                  description: model.owned_by ? `Provider: ${model.owned_by}` : undefined,
                }));
            }
          } catch (fallbackError) {
            console.error('Fallback to /v1/models also failed:', fallbackError);
          }
        }

        return [{
          name: 'Error loading models',
          value: '',
          description: 'Failed to fetch available models.',
        }];
      },
    },
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
        } else if (operation === 'flowEngineLlm') {
          const llmMessage = this.getNodeParameter('llmMessage', i) as string;
          const llmModel = this.getNodeParameter('llmModel', i) as string;
          const temperature = this.getNodeParameter('temperature', i) as number;

          const apiKey = process.env.FLOWENGINE_LLM_API_KEY;

          if (!apiKey) {
            throw new NodeOperationError(
              this.getNode(),
              'FlowEngine LLM is only available for FlowEngine-hosted n8n instances. ' +
              'Visit app.flowengine.cloud to get a hosted instance with this feature.',
              { itemIndex: i }
            );
          }

          const body = {
            model: llmModel,
            messages: [{ role: 'user', content: llmMessage }],
            temperature: temperature,
          };

          const response = await this.helpers.request({
            method: 'POST',
            url: 'https://litellm.flowengine.cloud/v1/chat/completions',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body,
            json: true,
          });

          if (response.choices && response.choices.length > 0) {
            returnData.push({
              json: {
                success: true,
                response: response.choices[0].message.content,
                model: llmModel,
                usage: response.usage,
              },
              pairedItem: i,
            });
          } else {
            throw new NodeOperationError(
              this.getNode(),
              'No response from LLM API',
              { itemIndex: i }
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
