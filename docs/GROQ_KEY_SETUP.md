# Get a Groq key privately

The Studio interface requires no AI API key. When ready for the separate Groq integration:

1. Sign in to your own account at [Groq Console → API Keys](https://console.groq.com/keys).
2. Verify the organization/project is the one you want and stays on the **Free** plan. Upgrading to Developer introduces usage billing.
3. Choose **Create API Key**, name it `AutoBlog Studio`, and copy the generated key into your password manager or private environment file. Do not paste it into chat, GitHub, screenshots, or the website.
4. Check the account's model availability and limits. The free tier is limited and can change; do not enable paid fallback or rotate accounts/keys to evade quotas.
5. Wait for the Groq adapter and provider configuration to be implemented before enabling generation. Studio currently sends `AI_API_KEY` to OpenAI's endpoint, so do not put a Groq credential into the active OpenAI configuration.

Once the Groq integration exists, its documented provider/key variable will be used on the backend only. No credential is needed to review the new UI. No Groq key, account, billing upgrade or real model request was created during this design task.

Official references: [API keys](https://console.groq.com/keys), [rate limits](https://console.groq.com/docs/rate-limits), [billing](https://console.groq.com/docs/billing-faqs).
