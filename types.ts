
export interface TraceableSkill {
  name: string;
  category: string;
  source: 'experience' | 'education' | 'certification' | 'user_note';
  evidence?: string;
}

export interface Profile {
  name: string;
  primary_roles: string[];
  secondary_roles: string[];
  years_of_experience?: number; // Calculated in frontend/utils, not from LLM
  domains: string[];
  skills: TraceableSkill[]; // Updated structure
  experience: Experience[];
  certifications: string[];
  education: string[];
  extra_knowledge: string[];
}

export interface Experience {
  company: string;
  role: string;
  start_date: string;
  end_date: string;
  domains: string[];
  key_contributions: string[];
}

export interface JobOffer {
  title: string;
  seniority: string;
  required_experience_years: number;
  must_have_skills: string[];
  nice_to_have_skills: string[];
  domains: string[];
  ats_keywords: string[];
}

export interface MatchResult {
  match_score: number;
  score_breakdown: {
    skills: number;
    experience: number;
    domain: number;
    education_certifications: number;
    other: number;
  };
  strengths: string[];
  gaps: string[];
  recommendations: string[];
}

export interface TailoredCV {
  professional_summary: string;
  skills_section: string[];
  experience_section: Experience[];
  education_section: string[];
  certifications_section: string[];
}
