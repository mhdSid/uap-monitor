// ─── Contact ────────────────────────────────────────────────────────

export const CONTACT = {
  EMAIL: 'contact@uapmonitor.org',
  MAILTO: 'mailto:contact@uapmonitor.org'
} as const

// ─── Footer links ───────────────────────────────────────────────────

export const FOOTER_LINKS = {
  TERMS: 'Terms',
  CONTACT: 'Contact'
} as const

// ─── Terms of Service ───────────────────────────────────────────────

export const TERMS = {
  TITLE: 'TERMS OF SERVICE',
  LAST_UPDATED: 'Last updated: March 2026',
  SECTIONS: [
    {
      heading: '1. Acceptance',
      body: 'By accessing UAP Monitor (uapmonitor.org), you agree to these terms. If you do not agree, do not use this platform.'
    },
    {
      heading: '2. Description of Service',
      body: 'UAP Monitor is an open-source intelligence platform that aggregates UAP/UFO sighting data from publicly available sources. The platform is provided free of charge for research, education, and public interest purposes. UAP Monitor is a non-commercial project.'
    },
    {
      heading: '3. Data Sources and Accuracy',
      body: 'Sighting data is aggregated from third-party sources including NUFORC, researcher chronologies, government archives, and news feeds. UAP Monitor does not verify the accuracy of individual sighting reports. Data is presented as-is from its original source. Credibility scores are algorithmically derived and do not constitute an endorsement or validation of any claim.'
    },
    {
      heading: '4. Open Data',
      body: 'All sighting data on UAP Monitor is open data. You may freely access, download, and use the data for research, analysis, journalism, or education. Attribution to UAP Monitor and the original data source is appreciated but not required.'
    },
    {
      heading: '5. Open Source',
      body: 'The UAP Monitor source code is publicly available. Contributions are welcome. The software is provided as-is without warranty of any kind.'
    },
    {
      heading: '6. User Conduct',
      body: 'You agree not to: attempt to disrupt or overload the platform infrastructure; scrape data at a rate that degrades service for other users; misrepresent UAP Monitor data as your own proprietary research; use the platform to harass, defame, or target individuals named in sighting reports.'
    },
    {
      heading: '7. Privacy',
      body: 'UAP Monitor does not collect personal data, require user accounts, or use tracking cookies. Basic analytics may be collected in aggregate to understand usage patterns. No personal information is sold or shared with third parties.'
    },
    {
      heading: '8. Third-Party Content',
      body: 'UAP Monitor links to and aggregates content from third-party sources including news articles, government documents, and research databases. UAP Monitor does not control and is not responsible for the content, accuracy, or availability of these external sources.'
    },
    {
      heading: '9. Disclaimer of Warranties',
      body: 'UAP Monitor is provided on an "as is" and "as available" basis. No warranty is made regarding accuracy, completeness, reliability, or fitness for any particular purpose. The inclusion of a sighting report on this platform does not constitute a claim that the reported event occurred as described.'
    },
    {
      heading: '10. Limitation of Liability',
      body: 'UAP Monitor and its developer shall not be liable for any direct, indirect, incidental, or consequential damages arising from the use of this platform or reliance on its data.'
    },
    {
      heading: '11. Changes to Terms',
      body: 'These terms may be updated at any time. Continued use of the platform after changes constitutes acceptance of the updated terms.'
    },
    {
      heading: '12. Contact',
      body: 'For questions, data corrections, or partnership inquiries: contact@uapmonitor.org'
    }
  ]
} as const
