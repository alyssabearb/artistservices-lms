export function getTableNames() {
  return {
    contacts: process.env.AIRTABLE_TABLE_CONTACTS ?? "Contacts",
    assignments: process.env.AIRTABLE_TABLE_ASSIGNMENTS ?? "Assignments",
    tracks: process.env.AIRTABLE_TABLE_TRACKS ?? "Learning Tracks",
    courses: process.env.AIRTABLE_TABLE_COURSES ?? "Courses",
    sections: process.env.AIRTABLE_TABLE_SECTIONS ?? "Training Sections",
    resources: process.env.AIRTABLE_TABLE_RESOURCES ?? "Resource Library",
    surveySubmissions: process.env.AIRTABLE_TABLE_SURVEY_SUBMISSIONS ?? "Survey Submissions",
  };
}
