
import { GoogleGenAI, Type } from "@google/genai";
import { SYSTEM_PROMPT } from "../constants";
import { AnalysisResponse, ScanResult, EngineProvider } from "../types";

export class AIService {
  private getGemini() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  private handleApiError(error: any, provider: string) {
    console.error(`${provider} Error:`, error);
    if (!navigator.onLine) throw new Error("Network Error: Please check your internet connection.");
    
    // Handle standard HTTP errors if they exist on the error object
    if (error.status === 401 || error.message?.includes("401") || error.message?.includes("API_KEY_INVALID")) {
      throw new Error(`${provider} Error: Invalid API Key. Please check your settings.`);
    }
    if (error.status === 429 || error.message?.includes("429")) {
      throw new Error(`${provider} Error: Rate limit exceeded. Please wait a moment.`);
    }
    if (error.status >= 500 || error.message?.includes("500")) {
      throw new Error(`${provider} Error: Remote server error. The provider might be down.`);
    }
    
    throw new Error(error.message || `An unexpected error occurred with ${provider}.`);
  }

  /**
   * Performs a search using the active engine or Brave Search.
   */
  async performDorkSearch(
    query: string, 
    engine: EngineProvider, 
    keys: { brave: string }
  ): Promise<{ text: string; sources: ScanResult[] }> {
    
    if (engine === 'gemini') {
      try {
        const ai = this.getGemini();
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Execute the following security dork and summarize results: "${query}"`,
          config: { tools: [{ googleSearch: {} }] },
        });

        const sources: ScanResult[] = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
          title: chunk.web?.title || 'Unknown Source',
          href: chunk.web?.uri || '#',
          body: 'Source identified via Google Search grounding.',
          source: 'Google'
        })) || [];

        return { text: response.text || "No summary available.", sources };
      } catch (e) {
        this.handleApiError(e, "Gemini Search");
      }
    }

    if (keys.brave) {
      try {
        const response = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`, {
          headers: { 'X-Subscription-Token': keys.brave, 'Accept': 'application/json' }
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw { status: response.status, message: errorData.message || "Brave Search Request Failed" };
        }

        const data = await response.json();
        const results = data.web?.results?.map((r: any) => ({
          title: r.title,
          href: r.url,
          body: r.description,
          source: 'Brave'
        })) || [];
        
        return { text: `Retrieved ${results.length} nodes from Brave Search index.`, sources: results };
      } catch (e) {
        this.handleApiError(e, "Brave Search");
      }
    }

    throw new Error(`Engine ${engine} requires specific API configuration or grounding support.`);
  }

  /**
   * Analyzes findings using the selected AI agent.
   */
  async analyzeResults(
    target: string, 
    results: ScanResult[], 
    engine: EngineProvider, 
    keys: { openrouter: string, huggingface: string }
  ): Promise<AnalysisResponse> {
    const resultsContext = results.map(r => `Title: ${r.title}\nURL: ${r.href}\nSnippet: ${r.body}`).join('\n\n');
    const prompt = `Analyze these search results for "${target}" and identify security threats. Return JSON only with "summary", "potentialThreats" as an array of objects with "description" and "severity" (0.0-10.0), and "recommendations"[].\n\nResults:\n${resultsContext}`;

    if (engine === 'gemini') {
      try {
        const ai = this.getGemini();
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: prompt,
          config: {
            systemInstruction: SYSTEM_PROMPT,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: { type: Type.STRING },
                potentialThreats: { 
                  type: Type.ARRAY, 
                  items: { 
                    type: Type.OBJECT,
                    properties: {
                      description: { type: Type.STRING },
                      severity: { type: Type.NUMBER }
                    },
                    required: ["description", "severity"]
                  } 
                },
                recommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["summary", "potentialThreats", "recommendations"]
            }
          },
        });
        return JSON.parse(response.text || "{}");
      } catch (e) {
        this.handleApiError(e, "Gemini Analysis");
      }
    }

    if (engine === 'openrouter' && keys.openrouter) {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${keys.openrouter}`,
            "Content-Type": "application/json",
            "HTTP-Referer": window.location.origin,
            "X-Title": "Ghost Dork v5"
          },
          body: JSON.stringify({
            model: "openai/gpt-4o-mini",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" }
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw { status: response.status, message: errorData.error?.message || "OpenRouter Request Failed" };
        }

        const data = await response.json();
        return JSON.parse(data.choices[0].message.content);
      } catch (e) {
        this.handleApiError(e, "OpenRouter");
      }
    }

    if (engine === 'huggingface' && keys.huggingface) {
      try {
        const response = await fetch("https://api-inference.huggingface.co/models/meta-llama/Llama-3-8B-Instruct", {
          method: "POST",
          headers: { 
            "Authorization": `Bearer ${keys.huggingface}`,
            "Content-Type": "application/json" 
          },
          body: JSON.stringify({ inputs: `<|system|>\n${SYSTEM_PROMPT}\n<|user|>\n${prompt}\n<|assistant|>` })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw { status: response.status, message: errorData.error || "Hugging Face Request Failed" };
        }

        const data = await response.json();
        const text = data[0]?.generated_text || "{}";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : { summary: "Raw output received.", potentialThreats: [], recommendations: [] };
      } catch (e) {
        this.handleApiError(e, "Hugging Face");
      }
    }

    return {
      summary: "Analysis failed. Ensure API keys are correctly configured for " + engine,
      potentialThreats: [{ description: "Configuration Error", severity: 0.0 }],
      recommendations: ["Check Settings > Provider Matrix"]
    };
  }
}

export const aiService = new AIService();
