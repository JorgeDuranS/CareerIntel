
import { GoogleGenAI, Type } from "@google/genai";
import { Profile, JobOffer, MatchResult, TailoredCV } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

/**
 * Robustly extracts and parses JSON from a string that might contain markdown or extra text.
 */
const parseGeminiResponse = (text: string) => {
  try {
    // Attempt to find JSON block
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse Gemini JSON response:", text);
    throw new Error("Invalid intelligence synthesis. The engine could not structure the data.");
  }
};

/**
 * Helper to retry functions with exponential backoff
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0 && (
      error?.status === 429 || error?.code === 429 || error?.toString().includes('429') ||
      error?.status === 503 || error?.code === 503 || error?.toString().includes('503')
    )) {
      console.warn(`Transient error (${error?.status || error?.code}). Retrying in ${delay}ms... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

export const geminiService = {
  /**
   * Module 1: Profile Ingestion
   */
  async extractProfile(text: string): Promise<Profile> {
    const run = async () => {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: `Extract a professional profile from the following text. 
        
        CRITICAL RULES:
        1. SKILLS: Extract ONLY technical skills/tools.
           - For EACH skill, identify the SOURCE (experience, education, certification).
           - Provide specific EVIDENCE (the snippet of text where it was found).
           - Do NOT include soft skills (leadership, communication, etc.).
           - Do NOT infer skills not explicitly stated.
        
        2. STRUCTURE: Return skills as a flat array of 'TraceableSkill' objects.
        
        Input Text: ${text}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              primary_roles: { type: Type.ARRAY, items: { type: Type.STRING } },
              secondary_roles: { type: Type.ARRAY, items: { type: Type.STRING } },
              domains: { type: Type.ARRAY, items: { type: Type.STRING } },
              skills: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    category: { type: Type.STRING },
                    source: { type: Type.STRING, enum: ["experience", "education", "certification", "user_note"] },
                    evidence: { type: Type.STRING }
                  },
                  required: ["name", "category", "source"]
                }
              },
              experience: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    company: { type: Type.STRING },
                    role: { type: Type.STRING },
                    start_date: { type: Type.STRING },
                    end_date: { type: Type.STRING },
                    domains: { type: Type.ARRAY, items: { type: Type.STRING } },
                    key_contributions: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ["company", "role", "key_contributions"]
                }
              },
              certifications: { type: Type.ARRAY, items: { type: Type.STRING } },
              education: { type: Type.ARRAY, items: { type: Type.STRING } },
              extra_knowledge: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["name", "primary_roles", "skills", "experience", "domains"]
          }
        }
      });
      return parseGeminiResponse(response.text);
    };
    return withRetry(run);
  },

  /**
   * Module 1.5: Natural Language Intelligence Processing
   */
  async processNewIntelligence(text: string): Promise<Record<string, string[]>> {
    const run = async () => {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: `Act as a Professional Knowledge Miner. Analyze the input below to extract specific technical skills, tools, and certifications.
        Group them into logical, concise categories. Normalize names (e.g., 'AWS' instead of 'Amazon Web Services').
        
        Input: ${text}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              categories: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    skills: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ["name", "skills"]
                }
              }
            },
            required: ["categories"]
          }
        }
      });
      const parsed = parseGeminiResponse(response.text);
      // Transform back to Record<string, string[]> for frontend compatibility
      const result: Record<string, string[]> = {};
      parsed.categories?.forEach((cat: any) => {
        if (cat.name && Array.isArray(cat.skills)) {
          result[cat.name] = cat.skills;
        }
      });
      return result;
    };
    return withRetry(run);
  },

  /**
   * Module 2: Job Offer Analysis
   */
  async analyzeJob(text: string): Promise<JobOffer> {
    const run = async () => {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: `Transform this job offer into a structured JSON object for matching analysis.
        Job Description: ${text}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              seniority: { type: Type.STRING },
              required_experience_years: { type: Type.NUMBER },
              must_have_skills: { type: Type.ARRAY, items: { type: Type.STRING } },
              nice_to_have_skills: { type: Type.ARRAY, items: { type: Type.STRING } },
              domains: { type: Type.ARRAY, items: { type: Type.STRING } },
              ats_keywords: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["title", "must_have_skills", "ats_keywords", "domains", "seniority"]
          }
        }
      });
      return parseGeminiResponse(response.text);
    };
    return withRetry(run);
  },

  /**
   * Module 3: Matching Engine
   */
  async matchProfileToJob(profile: Profile, job: JobOffer): Promise<MatchResult> {
    const run = async () => {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: `
          Act as a Career Intelligence Engine. Calculate a semantic match between this Profile and Job.
          Apply weights: Skills (40%), Experience/Seniority (25%), Domain (20%), Certifications (10%), Other (5%).
          
          CRITICAL: 
          - Return all 'score_breakdown' values as decimals between 0 and 1, representing unweighted proficiency in that category.
          - Do NOT calculate the final match_score.
          
          Profile JSON: ${JSON.stringify(profile)}
          Job JSON: ${JSON.stringify(job)}
        `,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              // match_score removed, calculated in frontend
              score_breakdown: {
                type: Type.OBJECT,
                properties: {
                  skills: { type: Type.NUMBER },
                  experience: { type: Type.NUMBER },
                  domain: { type: Type.NUMBER },
                  education_certifications: { type: Type.NUMBER },
                  other: { type: Type.NUMBER }
                },
                required: ["skills", "experience", "domain", "education_certifications", "other"]
              },
              strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
              gaps: { type: Type.ARRAY, items: { type: Type.STRING } },
              recommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["score_breakdown", "strengths", "gaps"]
          }
        }
      });
      return parseGeminiResponse(response.text);
    };
    return withRetry(run);
  },

  /**
   * Module 5: ATS CV Generation
   */
  async generateTailoredCV(profile: Profile, job: JobOffer): Promise<TailoredCV> {
    const run = async () => {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: `
          SYSTEM ROLE:
          You are a CV Generation Engine specialized in ATS-compliant resumes.
          Your primary responsibility is to generate truthful, traceable, and role-aligned CVs.
          You MUST NOT invent, infer, or embellish any experience, skill, responsibility, or credential.

          ────────────────────────────────────────
          CORE PRINCIPLES (NON-NEGOTIABLE)
          ────────────────────────────────────────
          1. TRUTHFULNESS:
             - Every item included in the CV MUST be directly traceable to the Profile JSON.
             - DO NOT infer seniority, responsibilities, tools, platforms, or scope.
             - DO NOT rename or enhance job titles.
             - DO NOT invent certifications, education, or experience.

          2. TRACEABILITY:
             - If a skill, bullet point, or section cannot be traced to:
               a) experience entries,
               b) skills lists, or
               c) extra_knowledge,
               it MUST NOT be included.

          3. LANGUAGE:
             - Use ONLY the language specified in the input (e.g., English US).
             - DO NOT mix languages.

          4. OUTPUT DISCIPLINE:
             - Output ONLY the final CV.
             - DO NOT include explanations, reasoning, notes, or meta-commentary.

          ────────────────────────────────────────
          INPUTS
          ────────────────────────────────────────
          Profile JSON: ${JSON.stringify(profile)}
          Job JSON: ${JSON.stringify(job)}
          
          ────────────────────────────────────────
          SKILL MANAGEMENT RULES (EXPERTISE MAP)
          ────────────────────────────────────────
          1. QUANTITY: Generate between 10 and 12 items maximum.
          2. QUALITY: Each item must be a distinct TECHNICAL capability. 
             - Merge overlapping concepts (e.g., "IAM, Access Control, MFA" -> "Identity & Access Management").
          3. EXCLUSION: Do NOT include soft skills unless explicitly required by the job.
          4. TRACEABILITY (CRITICAL):
             - Every skill/tool/domain key MUST be supported by:
               a) A bullet point in Professional Experience, OR
               b) An Education/Certification entry, OR
               c) Explicit user notes.
             - If no evidence exists in the input, DELETE the skill.

          ────────────────────────────────────────
          EXPERIENCE SECTION RULES
          ────────────────────────────────────────
          1. Use ONLY experience entries provided in the Profile JSON.
          2. DATES LOGIC:
             - Only the MOST RECENT role can be marked "Present" (or "Actualidad").
             - If older roles are marked "Present", change them to their logical end date (e.g., start date of the next role).
             - Mark as "Concurrent" ONLY if explicitly stated in the input.
          3. CONTENT:
             - Rewrite bullet points to highlight relevance to the target job.
             - Do NOT add new responsibilities/tools not found in the input.

          ────────────────────────────────────────
          EDUCATION & CERTIFICATIONS (MANDATORY)
          ────────────────────────────────────────
          1. ALWAYS generate a dedicated "Education & Certifications" section.
          2. NEVER merge this into experience or skills.
          3. Include ALL formal degrees and RELEVANT certifications.

          ────────────────────────────────────────
          CV STRUCTURE (ATS SAFE)
          ────────────────────────────────────────
          The CV MUST follow this structure:

          1. Header (Name + Target Role)
          2. Professional Summary (derived strictly from Profile + Job alignment)
          3. Core Skills / Expertise (Tier 1 + Tier 2 only)
          4. Professional Experience
          5. Education & Certifications
        `,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              professional_summary: { type: Type.STRING },
              skills_section: { type: Type.ARRAY, items: { type: Type.STRING } },
              experience_section: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    company: { type: Type.STRING },
                    role: { type: Type.STRING },
                    start_date: { type: Type.STRING },
                    end_date: { type: Type.STRING },
                    key_contributions: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ["company", "role", "start_date", "end_date", "key_contributions"]
                }
              },
              education_section: { type: Type.ARRAY, items: { type: Type.STRING } },
              certifications_section: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["professional_summary", "skills_section", "experience_section", "education_section", "certifications_section"]
          }
        }
      });
      return parseGeminiResponse(response.text);
    };
    return withRetry(run);
  }
};
