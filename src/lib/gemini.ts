import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing from environment variables.");
}

export const genAI = new GoogleGenerativeAI(apiKey);

// We default to gemini-2.5-pro for complex routing and architectural tasks
export const getModel = (modelName: string = "gemini-2.5-pro") => {
    return genAI.getGenerativeModel({ model: modelName });
};
