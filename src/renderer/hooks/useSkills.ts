import { useState, useEffect } from 'react';
import { setLoadedSkills, listAvailableSkills, Skill } from '../lib/skillSystem';

interface SkillInfo {
  id: string;
  name: string;
}

export function useSkills(projectPath: string | null) {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadSkills();
  }, [projectPath]);

  async function loadSkills() {
    try {
      const rawSkills = await (window.api as any).skills?.load(projectPath ?? undefined);
      if (!rawSkills || !Array.isArray(rawSkills)) {
        setIsLoaded(true);
        return;
      }

      const map = new Map<string, Skill>();
      for (const s of rawSkills) {
        map.set(s.id, {
          id: s.id,
          name: s.name,
          content: s.content,
          triggers: [],
          priority: s.id === 'base' ? 0 : 1,
        });
      }
      setLoadedSkills(map);
      setSkills(listAvailableSkills());
      setIsLoaded(true);
    } catch {
      setIsLoaded(true);
    }
  }

  return { skills, isLoaded, reload: loadSkills };
}
