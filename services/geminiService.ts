
import { GoogleGenAI, Type } from "@google/genai";
import { SYSTEM_PROMPT } from "../constants";
import { AnalysisResponse, ScanResult } from "../types";

export class GeminiService {
  /**
   * Performs a Google Search grounded query to find dork results.
   */
  async performDorkSearch(query: string): Promise<{ text: string; sources: ScanResult[] }> {
    try {
      // Create a new instance right before call to ensure latest API key
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Execute the following dork-style search query and provide a summary of the most relevant findings for a security researcher: "${query}"`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const sources: ScanResult[] = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
        title: chunk.web?.title || 'Unknown Source',
        href: chunk.web?.uri || '#',
        body: 'Source identified via Google Search grounding.',
        source: 'Google'
      })) || [];

      return {
        text: response.text || "No summary available.",
        sources
      };
    } catch (error) {
      console.error("Gemini Search Error:", error);
      throw error;
    }
  }

  /**
   * Analyzes the findings and provides structured threat intelligence.
   */
  async analyzeResults(target: string, results: ScanResult[]): Promise<AnalysisResponse> {
    const resultsContext = results.map(r => `Title: ${r.title}\nURL: ${r.href}`).join('\n\n');
    
    try {
      // Create a new instance right before call to ensure latest API key
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze the following search results for the target domain "${target}" and identify security threats:\n\n${resultsContext}`,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING, description: "A high-level summary of the findings." },
              potentialThreats: { 
                type: Type.ARRAY, 
                // Fix: Items must be objects of type Threat (description and severity)
                items: { 
                  type: Type.OBJECT,
                  properties: {
                    description: { type: Type.STRING },
                    severity: { type: Type.NUMBER }
                  },
                  required: ["description", "severity"]
                },
                description: "List of specific security threats identified."
              },
              recommendations: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "Actionable steps to remediate the issues."
              }
            },
            required: ["summary", "potentialThreats", "recommendations"]
          }
        },
      });

      return JSON.parse(response.text || "{}");
    } catch (error) {
      console.error("Gemini Analysis Error:", error);
      return {
        summary: "Analysis failed due to an internal error.",
        // Fix: Type 'string' is not assignable to type 'Threat'.
        potentialThreats: [{ description: "Unknown risk", severity: 0.0 }],
        recommendations: ["Check logs and try again."]
      };
    }
  }
}

export const geminiService = new GeminiService();
