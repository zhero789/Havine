
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, MediaItem } from "../types";

// Always create a new instance when needed to ensure fresh API key, but keep a default for simple calls
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to resize image to reduce token usage
const resizeImage = (dataUrl: string, maxWidth = 800): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      // Return bare base64 string
      resolve(canvas.toDataURL('image/jpeg', 0.7).split(',')[1]);
    };
  });
};

export const analyzeContent = async (
  items: MediaItem[],
  promptText: string = "Analyze this collection of images. Generate a structured comprehensive report suitable for a PDF document."
): Promise<AnalysisResult> => {
  const ai = getAI();
  try {
    const parts = [];

    // Process items
    for (const item of items) {
      // Single Image
      const resizedData = await resizeImage(item.previewUrl);
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: resizedData
        }
      });
    }

    parts.push({
      text: `${promptText}. 
      The input contains ${items.length} images.
      Return the response in JSON format with the following schema:
      {
        "title": "A concise title for the document based on the visual content",
        "summary": "A comprehensive summary of what these images depict (3-4 sentences)",
        "keyPoints": ["Key observation 1", "Key observation 2", "Key observation 3", "Key observation 4"],
        "content": "A detailed report describing the visual narrative, timeline, or collection details found in the provided media. Format as a long string with paragraphs."
      }`
    });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: parts
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            summary: { type: Type.STRING },
            keyPoints: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            content: { type: Type.STRING }
          },
          required: ["title", "summary", "keyPoints", "content"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as AnalysisResult;
    }
    throw new Error("No response text generated");
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const base64String = reader.result.split(',')[1];
        resolve(base64String);
      } else {
        reject(new Error("Failed to convert file to base64"));
      }
    };
    reader.onerror = error => reject(error);
  });
};
