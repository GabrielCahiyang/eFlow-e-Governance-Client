export const MAX_ACCOUNT_SKILLS=100;
export const MAX_ACCOUNT_SKILL_LENGTH=100;
const unsupported=/[\x00-\x1f\x7f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/;
export function accountSkillsError(skills:Record<string,boolean>){
 if(Object.keys(skills).length>MAX_ACCOUNT_SKILLS)return 'Add up to 100 skills.';
 return Object.keys(skills).some(skill=>!skill.trim()||skill.length>MAX_ACCOUNT_SKILL_LENGTH||unsupported.test(skill))?'Each skill must contain 1–100 characters without hidden or control characters.':'';
}
