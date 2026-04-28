import type { LanguageCode } from '@/types'

const STRINGS: Record<LanguageCode, Record<string, string>> = {
  en: {
    home: 'Home',
    explore: 'Explore',
    saved: 'Saved',
    settings: 'Settings',
    profile: 'Profile',
    trending: 'Trending now',
    editorPicks: "Editor's picks",
    recommendations: 'Recommended for you',
    comments: 'Discussion',
    share: 'Share',
    addComment: 'Add comment',
    post: 'Post',
    newsletter: 'Newsletter digest',
    customRss: 'Custom RSS feeds',
    exportBookmarks: 'Export bookmarks',
    language: 'Language',
  },
  hi: {
    home: 'होम',
    explore: 'खोज',
    saved: 'सेव्ड',
    settings: 'सेटिंग्स',
    profile: 'प्रोफाइल',
    trending: 'ट्रेंडिंग',
    editorPicks: 'एडिटर पिक्स',
    recommendations: 'आपके लिए सुझाव',
    comments: 'चर्चा',
    share: 'शेयर',
    addComment: 'टिप्पणी जोड़ें',
    post: 'पोस्ट',
    newsletter: 'न्यूज़लेटर सारांश',
    customRss: 'कस्टम RSS फीड्स',
    exportBookmarks: 'बुकमार्क एक्सपोर्ट',
    language: 'भाषा',
  },
}

export function t(language: LanguageCode, key: string): string {
  return STRINGS[language]?.[key] ?? STRINGS.en[key] ?? key
}
