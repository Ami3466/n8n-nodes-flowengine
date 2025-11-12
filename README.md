# n8n-nodes-flowengine

This is an n8n community node that lets you use [FlowEngine AI](https://flowengine.cloud) in your n8n workflows.

FlowEngine is an AI-powered workflow automation platform that helps you create and manage intelligent workflows.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

### Community Nodes (Recommended)

1. Go to **Settings > Community Nodes**
2. Select **Install**
3. Enter `n8n-nodes-flowengine` in **Enter npm package name**
4. Agree to the [risks](https://docs.n8n.io/integrations/community-nodes/risks/) of using community nodes
5. Select **Install**

### Manual Installation

To get started install the package in your n8n root directory:

```bash
npm install n8n-nodes-flowengine
```

For Docker-based deployments add the following line before the font installation command in your [n8n Dockerfile](https://github.com/n8n-io/n8n/blob/master/docker/images/n8n/Dockerfile):

```
RUN cd /usr/local/lib/node_modules/n8n && npm install n8n-nodes-flowengine
```

## Operations

### Send Message

Send a message to FlowEngine AI and get an intelligent response.

**Parameters:**
- **Message**: The message/prompt to send to FlowEngine AI
- **Model**: Choose between Regular (faster, standard) or Boost (more powerful)
- **Conversation ID** (optional): Continue an existing conversation

**Returns:**
- `success`: Whether the request was successful
- `response`: The AI's response
- `conversation_id`: ID to continue the conversation
- `credits_remaining`: Your remaining FlowEngine credits

## Credentials

You need a FlowEngine API key to use this node.

### Getting Your API Key

1. Sign up at [flowengine.cloud](https://flowengine.cloud)
2. Go to **Settings > API Access**
3. Click **Generate API Key**
4. Copy and save your API key securely

### Setting Up Credentials in n8n

1. Go to **Credentials** in n8n
2. Click **Create New**
3. Search for **FlowEngine API**
4. Paste your API key
5. Click **Save**

## Compatibility

Tested with n8n version 0.228.0+

## Usage

### Example: Simple AI Chat

1. Add a **FlowEngine** node
2. Set **Operation** to **Send Message**
3. Enter your message: `Create a workflow that sends daily email reports`
4. Choose **Model**: Regular or Boost
5. Execute the workflow

### Example: Conversational Workflow

1. **First Message** - FlowEngine node with initial question
2. **Follow-up** - Another FlowEngine node using the `conversation_id` from the first response
3. This maintains context across multiple AI interactions

### Example: Dynamic Messages

Use expressions to create dynamic messages:

```
{{ $json.userInput }}
```

This allows you to pass data from previous nodes into FlowEngine.

## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
* [FlowEngine API Documentation](https://app.flowengine.cloud/api-docs)
* [FlowEngine Website](https://flowengine.cloud)

## Version history

### 1.0.0

Initial release with:
- Send Message operation
- Regular and Boost model selection
- Conversation management
- Full API integration

## License

[MIT](LICENSE.md)
