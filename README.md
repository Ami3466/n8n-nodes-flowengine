# n8n-nodes-flowengine

**FlowEngine AI + Email Testing** - Powerful AI automation nodes for n8n workflows.

This community node package provides:
- **FlowEngine AI Chat** - Conversational AI with workflow intelligence
- **FlowEngine LLM** - 100+ AI models (OpenAI, Anthropic, Google, Mistral, etc.) via LangChain
- **Send Email Test** - Zero-setup email testing with embedded content (NEW!)

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

## Nodes

This package includes **3 powerful nodes**:

### 1. Send Email Test (NEW!)

**Zero-setup email testing with embedded content** - No SMTP configuration required!

Send test emails and instantly get the full email content embedded in the n8n output. Perfect for testing email workflows, templates, and automation.

**Features:**
- ✅ **No Setup Required** - Auto-generates test email accounts via Ethereal.email
- ✅ **Embedded Email Content** - Full email (HTML, text, headers, attachments) in n8n output
- ✅ **Instant Preview** - Click URL to view email in browser
- ✅ **Text & HTML Support** - Send plain text or HTML emails
- ✅ **Auto-Cached Credentials** - Reuses account for 48 hours per workflow
- ✅ **IMAP Fetching** - Retrieves sent email via IMAP automatically

**Parameters:**
- **To Email**: Recipient address (any email - won't actually deliver)
- **Subject**: Email subject line
- **Email Body**: Text or HTML content
- **Body Type**: Choose "Text" or "HTML"

**Returns:**
```json
{
  "success": true,
  "sentEmail": { "from": "...", "to": "...", "subject": "..." },
  "receivedEmail": {
    "subject": "...",
    "from": "...",
    "to": "...",
    "textContent": "Plain text version",
    "htmlContent": "<h1>HTML version</h1>",
    "headers": {...},
    "attachments": [...]
  },
  "previewUrl": "https://ethereal.email/message/...",
  "credentials": {
    "email": "test@ethereal.email",
    "password": "...",
    "webUrl": "https://ethereal.email"
  }
}
```

**Use Cases:**
- Test email templates before sending to real users
- Verify HTML rendering and formatting
- Debug email workflows without spamming inboxes
- Validate email content in automated tests
- Preview transactional emails

---

### 2. FlowEngine (AI Chat Node)

Send messages to FlowEngine AI and get intelligent responses for workflow automation.

**Parameters:**
- **Message**: The message/prompt to send to FlowEngine AI
- **Model**: Choose between Regular (faster, standard) or Boost (more powerful)
- **Conversation ID** (optional): Continue an existing conversation

**Returns:**
- `success`: Whether the request was successful
- `response`: The AI's response
- `conversation_id`: ID to continue the conversation
- `credits_remaining`: Your remaining FlowEngine credits

---

### 3. FlowEngine LLM Chat Model (LangChain Node)

A LangChain-compatible chat model node that provides access to **100+ AI models** for use with n8n's AI Agent, Chain, and other LangChain nodes.

**Features:**
- **Dynamic Model Loading**: Automatically fetches available models from your FlowEngine LLM configuration
- **Multiple Providers**: Access models from OpenAI, Anthropic, Google, Mistral, Groq, Cohere, and more
- **Provider Filtering**: Filter models by provider or view all available models
- **LangChain Compatible**: Works with AI Agent, Basic LLM Chain, Summarization Chain, and other LangChain nodes

**Configuration:**
- **Provider**: Select a specific AI provider or "All Providers" to see all available models
- **Model**: Choose from dynamically loaded models based on your configuration
- **Options**:
  - Temperature (0-2): Controls randomness in responses
  - Max Tokens: Maximum length of generated responses
  - Frequency/Presence Penalty: Reduce repetition (OpenAI-compatible models)
  - Top P: Alternative to temperature for controlling randomness
  - Timeout & Max Retries: Connection settings

**Availability:**
- **FlowEngine-Hosted Instances**: Automatically enabled with pre-configured API access
- **Self-Hosted**: Add API key in Options > API Key (Advanced) for testing

**Use Cases:**
- Build AI agents with tools and memory
- Create conversational workflows with context
- Summarize documents and extract information
- Generate structured outputs with multiple AI models
- Compare responses across different providers

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

### Send Email Test Node Examples

#### Example: Test HTML Email Template

1. Add a **Send Email Test** node
2. **To Email**: `customer@example.com` (any address - won't deliver)
3. **Subject**: `Welcome to Our Service!`
4. **Body Type**: HTML
5. **Email Body**:
```html
<h1>Welcome!</h1>
<p>Thanks for signing up, <strong>{{name}}</strong>!</p>
<a href="https://example.com">Get Started</a>
```
6. Execute and check `receivedEmail.htmlContent` in output

#### Example: Verify Email Workflow

1. **HTTP Request** node - Fetch user data
2. **Code** node - Generate personalized email HTML
3. **Send Email Test** node - Test the generated email
4. **IF** node - Check if `receivedEmail.htmlContent` contains expected content
5. **Send Email** node (real SMTP) - Send only if test passes

#### Example: Email A/B Testing

1. Create two **Send Email Test** nodes with different templates
2. Compare `receivedEmail.textContent` and `htmlContent` from both
3. Use **Code** node to analyze which performs better
4. Route to winning template for production

---

### FlowEngine Node Examples

#### Example: Simple AI Chat

1. Add a **FlowEngine** node
2. Set **Operation** to **Send Message**
3. Enter your message: `Create a workflow that sends daily email reports`
4. Choose **Model**: Regular or Boost
5. Execute the workflow

#### Example: Conversational Workflow

1. **First Message** - FlowEngine node with initial question
2. **Follow-up** - Another FlowEngine node using the `conversation_id` from the first response
3. This maintains context across multiple AI interactions

#### Example: Dynamic Messages

Use expressions to create dynamic messages:

```
{{ $json.userInput }}
```

This allows you to pass data from previous nodes into FlowEngine.

### FlowEngine LLM Chat Model Examples

#### Example: AI Agent with Tools

1. Add an **AI Agent** node
2. Connect a **FlowEngine LLM Chat Model** node to the Language Model input
3. Select provider (e.g., "Anthropic") and model (e.g., "claude-3-5-sonnet-20241022")
4. Add tool nodes (HTTP Request, Code, etc.) to the Tools input
5. Configure the agent with your prompt and memory
6. The agent can now use multiple AI models with custom tools

#### Example: Document Summarization

1. Add a **Summarization Chain** node
2. Connect a **FlowEngine LLM Chat Model** node
3. Choose a fast model like "gpt-4o-mini" or "claude-3-5-haiku"
4. Pass your document text to the chain
5. Get concise summaries using different AI providers

#### Example: Multi-Model Comparison

1. Create multiple **FlowEngine LLM Chat Model** nodes
2. Set each to a different provider (OpenAI, Anthropic, Google, etc.)
3. Connect them to a **Basic LLM Chain**
4. Run the same prompt through different models
5. Compare responses and quality across providers

## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
* [FlowEngine API Documentation](https://app.flowengine.cloud/api-docs)
* [FlowEngine Website](https://flowengine.cloud)

## Version history

### 1.5.2 (Latest)

- Rebranded Send Email Test node to "FlowEngine Send Email Test"
- Updated node icon to FlowEngine logo for consistent branding

### 1.5.0

- **NEW: Send Email Test Node** - Zero-setup email testing
  - Auto-generated Ethereal.email test accounts
  - Embedded email content via IMAP (HTML, text, headers, attachments)
  - Instant preview URLs
  - 48-hour credential caching per workflow
  - No SMTP configuration required
- Added dependencies: `nodemailer`, `imapflow`, `mailparser`
- Updated README with comprehensive examples

### 1.3.0

- Added FlowEngine LLM Chat Model node (LangChain-compatible)
- Dynamic model and provider loading
- Support for 100+ AI models across multiple providers
- Manual API key option for testing (hidden in Options)
- Upgraded to TypeScript 5.7

### 1.2.0

- Initial FlowEngine LLM node implementation
- Added @langchain/openai dependency

### 1.1.0

- Added FlowEngine LLM operation to main node
- Support for environment-based LLM access

### 1.0.0

Initial release with:
- Send Message operation
- Regular and Boost model selection
- Conversation management
- Full API integration

## License

[MIT](LICENSE.md)
