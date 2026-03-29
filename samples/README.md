# Bulk import sample templates

Use these Excel files as the **official format** for uploading students and teachers.

## Files

| File | Description |
|------|-------------|
| `students_import_template.xlsx` | 10 sample students (Kenyan names). Use sheet **Upload_Ready** to export CSV for upload. |
| `teachers_import_template.xlsx` | 5 sample teachers (Kenyan names). Use sheet **Upload_Ready** to export CSV for upload. |

## How to use

1. Open the Excel file.
2. **Students**: First sheet has instructions and sample data. Sheet **Upload_Ready** has header + data only.
3. **Teachers**: Same structure.
4. To upload in the app: open **Upload_Ready**, then **File → Save As → CSV (Comma delimited)**. Upload that CSV in the dashboard.

## Column format (do not change header names)

### Students

- `admission_number` – Unique per school (e.g. ADM-2024-001)
- `first_name`, `last_name`
- `date_of_birth` – YYYY-MM-DD
- `gender` – `male` or `female` or `other`
- `parent_phone` – e.g. +254712345678
- `parent_email` – Optional
- `class_name` – Must match an existing class (e.g. Grade 6)
- `stream_name` – Must match an existing stream (e.g. East), or leave blank
- `is_boarding` – `true` or `false`

### Teachers

- `first_name`, `last_name`
- `phone` – Unique per school (e.g. +254712345678)
- `email` – Optional
- `subject` – e.g. Mathematics
- `department` – e.g. Sciences

Sample data uses Kenyan names from various communities (Kikuyu, Kalenjin, Luo, Luhya, Kamba, Kisii, Maasai, Meru) as a reference for schools.
