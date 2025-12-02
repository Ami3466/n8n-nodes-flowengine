# n8n-nodes-flowengine

**FlowEngine — Simplifying n8n** - Making workflow automation easier with AI-powered tools.

This package provides:
- **FlowEngine AI workflow builder** - Build complete, validated workflows from plain text
- **FlowEngine LLM Chat Model** - Use all AI models with one API key from FlowEngine (pre-configured for FlowEngine-hosted n8n)
- **AI Session Manager** - The missing link for AI Agent setup - generate and manage session IDs effortlessly
- **Data Cleaner** - Clean and transform data without code - deduplicate, format phones, normalize emails, and more
- **Send Email Test** - Free zero-setup email testing, no API key needed

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

This package includes **5 powerful nodes**:

### 1. Send Email Test

**Free zero-setup email testing** - No API key or SMTP configuration required!

Send test emails and instantly get the full email content embedded in the n8n output. Perfect for testing email workflows, templates, and automation without any setup.

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

### 2. FlowEngine AI Workflow Builder

**Build complete, validated workflows from plain text** - Describe what you want and get ready-to-use n8n workflows.

Turn natural language descriptions into fully functional n8n workflows with intelligent validation and optimization.

**Parameters:**
- **Message**: Describe the workflow you want to create in plain text
- **Model**: Choose between Regular (faster, standard) or Boost (more powerful)
- **Conversation ID** (optional): Continue an existing conversation for iterative refinement

**Returns:**
- `success`: Whether the request was successful
- `response`: Complete workflow JSON or guidance
- `conversation_id`: ID to continue the conversation
- `credits_remaining`: Your remaining FlowEngine credits

**Use Cases:**
- Generate workflows from descriptions: "Create a workflow that sends daily email reports"
- Validate and optimize existing workflows
- Get AI assistance for complex automation logic
- Iterate on workflows with conversational refinement

---

### 3. FlowEngine LLM Chat Model

**Use all AI models with one API key from FlowEngine** - Access 50+ LLMs from OpenAI, Anthropic, Google, Mistral, and more.

Pre-configured for FlowEngine-hosted n8n instances with zero setup. Self-hosted users can connect with a single FlowEngine API key.

**Features:**
- **One API Key, All Models**: Single FlowEngine API key unlocks 50+ LLMs, including 10 free open-source LLMs for FlowEngine hosted users
- **Multiple Providers**: OpenAI, Anthropic (Claude), Google (Gemini), Mistral, Groq, Cohere, and more
- **Provider Filtering**: Filter models by provider or view all available models
- **Dynamic Model Loading**: Automatically fetches and updates available models
- **LangChain Compatible**: Works seamlessly with AI Agent, chains, and other LangChain nodes

**Configuration:**
- **Provider**: Select a specific AI provider or "All Providers" to see all available models
- **Model**: Choose from dynamically loaded models (updated in real-time)
- **Options**:
  - Temperature (0-2): Controls randomness in responses
  - Max Tokens: Maximum length of generated responses

**Availability:**
- **FlowEngine-Hosted n8n**: Automatically pre-configured, no credentials needed
- **Self-Hosted n8n**: Add your FlowEngine API key from Settings > API Access

**Use Cases:**
- Build AI agents with tools and memory
- Create conversational workflows with context
- Summarize documents and extract information
- Generate structured outputs with multiple AI models
- Compare responses across different providers

---

### 4. AI Session Manager

**The Missing Link for AI Agent Setup** - No more Code nodes or complex expressions just to get a session ID!

When you add an AI Agent with Memory, it requires a `sessionId`. This node eliminates the friction by generating and managing session IDs automatically.

**Features:**
- ✅ **Zero External Dependencies** - Uses Node.js native `crypto.randomUUID()`
- ✅ **Two Modes** - Simple generation or loop-persistent sessions
- ✅ **Loop Amnesia Fix** - Maintains the same session ID across loop iterations
- ✅ **No Configuration** - Works out of the box

**Mode 1: Generate New ID**
Creates a fresh UUID v4 for each execution. Perfect for:
- Starting new AI conversations
- Stateless AI interactions
- Each workflow run = new session

**Mode 2: Manage Loop Session**
Persists one session ID across multiple loop iterations using `getWorkflowStaticData`. Perfect for:
- Processing multiple items in a loop with the same AI Agent
- Building multi-turn conversations within a single workflow run
- Any scenario where the AI needs to "remember" across iterations

**Parameters:**
| Parameter | Mode | Description |
|-----------|------|-------------|
| Mode | All | Choose between "Generate New ID" or "Manage Loop Session" |
| Session Key | Loop | Unique key to store/retrieve session from static data |
| Reset Session | Loop | Force generate a new ID, replacing any existing one |

**Returns:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Example Workflows:**

Basic AI Agent Setup:
```
[Trigger] → [AI Session Manager] → [AI Agent with Memory]
```

Loop with Persistent Memory:
```
[Trigger] → [Split In Batches] → [AI Session Manager (Manage Loop)] → [AI Agent] → [Loop]
```

---

### 5. Data Cleaner

**Stop writing Code Nodes to clean your data. Use this.**

A production-ready node that cleans and transforms messy data without writing a single line of code. Built with zero runtime dependencies.

**Operations:**

#### Deduplicate (Fuzzy)
Remove duplicate records using intelligent fuzzy matching (Jaro-Winkler/Levenshtein algorithms).

| Parameter | Description | Default |
|-----------|-------------|---------|
| Fields to Check | Comma-separated field names to compare | Required |
| Fuzzy Threshold | Similarity threshold (0.0-1.0) | 0.8 |
| Output Duplicate Info | Include metadata about removed duplicates | false |

#### Clean Phone Numbers
Format phone numbers to E.164 international standard (`+15550001111`).

| Parameter | Description | Default |
|-----------|-------------|---------|
| Phone Field | Field containing phone number | `phone` |
| Default Country Code | Country code when not detected | `1` (US/Canada) |
| Output Field | Save to different field (optional) | Same as input |

#### Smart Capitalization
Convert text to proper Title Case with intelligent handling of common patterns.
- `jOhN dOE` → `John Doe`
- Preserves acronyms: `IBM`, `NASA`, `CEO`
- Handles articles: `The Lord of the Rings`

#### Normalize Email
Clean and standardize email addresses.
- Trims whitespace
- Converts to lowercase
- Corrects common domain typos (`gmial.com` → `gmail.com`)

#### Clean Object Keys
Transform all JSON keys to consistent naming convention.
- `snake_case`: `firstName` → `first_name`
- `camelCase`: `first_name` → `firstName`

**Features:**
- ✅ **Zero Runtime Dependencies** - All algorithms implemented natively
- ✅ **Nested Field Support** - Use dot notation (`contact.phone.mobile`)
- ✅ **Production Ready** - Handles edge cases and validation

## Credentials

You need a FlowEngine API key to use the FlowEngine Chat and FlowEngine LLM nodes.

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

**Note:** The same FlowEngine API credentials work for both the FlowEngine Chat node and the FlowEngine LLM Chat Model node. If you're hosting on FlowEngine, credentials are auto-configured.

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

---

### AI Session Manager Node Examples

#### Example: Quick AI Agent Setup

1. Add a **Trigger** node (Manual, Webhook, etc.)
2. Add an **AI Session Manager** node
3. Set **Mode**: Generate New ID
4. Add an **AI Agent** node
5. In the AI Agent, set **Session ID** to: `{{ $json.sessionId }}`
6. Done! Each execution gets a fresh session.

#### Example: Loop with Persistent Memory

When processing multiple items where the AI needs to remember previous iterations:

1. **Trigger** node with multiple items
2. **Split In Batches** node (batch size 1)
3. **AI Session Manager** node
   - Mode: `Manage Loop Session`
   - Session Key: `customerSupportSession`
4. **AI Agent** node using `{{ $json.sessionId }}`
5. **Loop** back to Split In Batches

The AI will maintain conversation context across all items in the loop.

#### Example: Multiple Parallel Conversations

For workflows handling multiple independent conversations:

1. Add multiple **AI Session Manager** nodes
2. Set different **Session Keys** for each (e.g., `agent1Session`, `agent2Session`)
3. Each AI Agent gets its own persistent session

---

### Data Cleaner Node Examples

#### Example: Clean Contact List

1. Add a **Data Cleaner** node
2. Set **Operation**: Deduplicate (Fuzzy)
3. **Fields to Check**: `name, email`
4. **Fuzzy Threshold**: `0.8`
5. Duplicate contacts like "John Smith" and "Jon Smith" are merged

#### Example: Format Phone Numbers

1. Add a **Data Cleaner** node
2. Set **Operation**: Clean Phone Numbers
3. **Phone Field**: `phone`
4. **Default Country Code**: `1`
5. Input: `(555) 000-1111` → Output: `+15550001111`

#### Example: Normalize API Response

1. Add a **Data Cleaner** node
2. Set **Operation**: Clean Object Keys
3. **Key Format**: `snake_case`
4. Input: `{ "firstName": "John", "lastName": "Doe" }`
5. Output: `{ "first_name": "John", "last_name": "Doe" }`

## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
* [FlowEngine API Documentation](https://app.flowengine.cloud/api-docs)
* [FlowEngine Website](https://flowengine.cloud)

## Version history

### 1.9.0 (Latest)

- **NEW: Data Cleaner Node** - Clean and transform data without code
  - Deduplicate (Fuzzy): Remove duplicates using Jaro-Winkler/Levenshtein algorithms
  - Clean Phone Numbers: Format to E.164 standard (+15550001111)
  - Smart Capitalization: Intelligent Title Case conversion
  - Normalize Email: Trim, lowercase, fix common typos
  - Clean Object Keys: Transform to snake_case or camelCase
  - Zero runtime dependencies - all algorithms implemented natively
  - Supports nested fields with dot notation

### 1.8.0

- **NEW: AI Session Manager Node** - The missing link for AI Agent setup
  - Generate UUID v4 session IDs with zero configuration
  - Manage Loop Session mode for persistent sessions across loop iterations
  - Solves the "Loop Amnesia" problem with `getWorkflowStaticData`
  - Zero external dependencies - uses native Node.js `crypto.randomUUID()`
  - No API key required

### 1.6.0

- **FlowEngine LLM Node Update**: Now uses shared FlowEngine API credentials
  - Same credentials work across all FlowEngine nodes (Chat, LLM)
  - Auto-configured for FlowEngine-hosted instances
  - Self-hosted users can add FlowEngine API key from Settings
  - Improved messaging and user experience
  - Removed internal implementation references

### 1.5.2

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
