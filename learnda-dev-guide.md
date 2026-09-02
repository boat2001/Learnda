# 📘 Learnda – COMPLETE AI AGENT DEVELOPMENT GUIDE

**(Refactor from Sharether Repository)**

---

## 0. PURPOSE (READ FIRST)

Learnda is a **Ghanaian K–12 digital learning system** that mirrors the **real school timeline** from **Kindergarten to SHS**.

Learnda must:

* Follow **actual academic progression**
* Lock learners to **one class per academic year**
* Allow **revision of past classes only**
* Prevent learners from jumping ahead
* Teach subjects **only at the learner’s current level**

Learnda is **not** a free-roam learning app.

---

## 1. HARD RULES (NON-NEGOTIABLE)

1. ❌ No `P1–P6` anywhere
   ✅ Use **Basic 1–6 (B1–B6)**

2. ❌ No tertiary concepts (courses, semesters, lecturers)

3. ❌ No KG exams, quizzes, or community/chat

4. ❌ Learners cannot change class level manually

5. ❌ No early exposure to higher-class content
   ✅ Computing & French are **class-scoped**

Violations must be fixed immediately.

---

## 2. EDUCATION STRUCTURE (LOCKED)

### 2.1 Level Groups

```ts
LevelGroup =
  | KINDERGARTEN
  | PRIMARY
  | JHS
  | SHS
```

---

### 2.2 Class Levels (Canonical Codes)

#### Kindergarten

* KG 1 → `KG1`
* KG 2 → `KG2`

#### Primary

* Basic 1 → `B1`
* Basic 2 → `B2`
* Basic 3 → `B3`
* Basic 4 → `B4`
* Basic 5 → `B5`
* Basic 6 → `B6`

#### Junior High School

* JHS 1 → `JHS1`
* JHS 2 → `JHS2`
* JHS 3 → `JHS3`

#### Senior High School

* SHS 1 → `SHS1`
* SHS 2 → `SHS2`
* SHS 3 → `SHS3`

---

### 2.3 UI ORDER (MANDATORY)

```
KG 1
KG 2
Basic 1
Basic 2
Basic 3
Basic 4
Basic 5
Basic 6
JHS 1
JHS 2
JHS 3
SHS 1
SHS 2
SHS 3
```

---

## 3. LEARNING MODEL (CRITICAL)

### 3.1 Learning Types

```ts
LearningType =
  | LEARNING_AREA   // Kindergarten only
  | SUBJECT         // Primary, JHS, SHS
```

KG uses **Learning Areas**.
Primary and JHS use **Subjects**.
SHS uses **Core Subjects + Learning Area / Pathway Subjects**.

---

## 4. CURRICULUM ALIGNMENT (GHANA – NaCCA)

---

### 4.1 Kindergarten (KG1–KG2) – Learning Areas

| Slug                    | Display Name                |
| ----------------------- | --------------------------- |
| `language_literacy`     | Language and Literacy       |
| `numeracy`              | Numeracy                    |
| `environmental_studies` | Environmental Studies       |
| `creative_arts`         | Creative Arts               |
| `physical_development`  | Physical Development        |
| `owop`                  | Our World, Our People       |
| `rme`                   | Religious & Moral Education |

Rules:

* ❌ Exams
* ❌ Quizzes
* ❌ Chat / community
* ✅ Audio-first
* ✅ Animation-first
* ✅ Parent-guided

---

### 4.2 Primary Subjects (B1–B6)

All Primary learners **B1–B6** can study **all Primary subjects**, but **content is strictly class-scoped**.

#### Core Primary Subjects

| Slug                | Subject                     |
| ------------------- | --------------------------- |
| `english`           | English Language            |
| `mathematics`       | Mathematics                 |
| `science`           | Science                     |
| `ghanaian_language` | Ghanaian Language & Culture |
| `owop`              | Our World and Our People    |
| `creative_arts`     | Creative Arts               |
| `history`           | History                     |
| `rme`               | Religious & Moral Education |
| `pe`                | Physical Education          |
| `computing`         | Computing                   |
| `french`            | French                      |

✅ **Computing & French are available from B1–B6**
❌ Learners must never see content above their class

---

### 4.3 JHS Subjects (JHS1–JHS3)

Use the same subject catalogue for **JHS1, JHS2, and JHS3**, but keep every topic, lesson, practice set, and assessment class-scoped.

| Slug                       | Subject                          |
| -------------------------- | -------------------------------- |
| `english`                  | English Language                 |
| `mathematics`              | Mathematics                      |
| `science`                  | Science                          |
| `social_studies`           | Social Studies                   |
| `french`                   | French                           |
| `arabic`                   | Arabic                           |
| `ghanaian_language`        | Ghanaian Language                |
| `physical_health_education`| Physical Education and Health    |
| `rme`                      | Religious and Moral Education    |
| `creative_arts_design`     | Creative Arts and Design         |
| `career_technology`        | Career Technology                |
| `computing`                | Computing                        |

#### JHS Availability Rule

```json
{
  "levelGroup": "JHS",
  "fromClass": "JHS1",
  "toClass": "JHS3",
  "learningType": "SUBJECT"
}
```

✅ A JHS1 learner sees JHS1 Science
❌ A JHS1 learner must not see JHS2 or JHS3 Science content

---

### 4.4 SHS Curriculum and Pathways (SHS1–SHS3)

SHS must not be modeled like Primary or JHS. Learners take **core subjects plus electives selected through a learning area / pathway**, subject to class, school availability, and valid subject-combination rules.

The app must not show every SHS subject to every learner.

#### Main SHS Core Subjects

| Slug             | Subject                              |
| ---------------- | ------------------------------------ |
| `english`        | English Language                     |
| `mathematics`    | Mathematics                          |
| `social_studies` | Social Studies                       |
| `general_science`| General Science                      |
| `peh_core`       | Physical Education and Health — Core|

#### SHS Intervention Subjects

These support learners identified through initial English and Mathematics assessment.

| Slug                       | Subject                   |
| -------------------------- | ------------------------- |
| `intervention_english`     | Intervention English      |
| `intervention_mathematics` | Intervention Mathematics  |

#### SHS Learning Areas / Pathways

Learnda must support all of these pathways:

1. Science
2. General Arts
3. Business
4. Applied Technology
5. Home Economics
6. Art
7. Agriculture
8. Languages
9. STEM — designated STEM schools only

#### 4.4.1 Science

| Category             | Subjects |
| -------------------- | -------- |
| Core                 | Mathematics, Social Studies, English Language, PEH Core |
| Science Electives    | Agriculture, Biology, Chemistry, Computing, Physics, Additional Mathematics, PEH Elective, Robotics, Engineering, Aviation & Aerospace |
| Additional Electives | ICT, Art and Design Studio, Applied Technology, Design & Communication Technology, Home Economics, Performing Arts, Business Studies, Art and Design Foundation, RME, Agricultural Science |
| Humanities Electives | Economics, Geography, Government, History, Religious Studies, Ghanaian Languages, Arabic, French, Literature in English |

#### 4.4.2 General Arts

| Category               | Subjects |
| ---------------------- | -------- |
| Core                   | Mathematics, Social Studies, English Language, General Science, PEH Core |
| General Arts Electives | Economics, Geography, Government, History, Religious Studies, Literature in English |
| Additional Electives   | ICT, Applied Technology, Design & Communication Technology, Art and Design Foundation, Art and Design Studio, Home Economics, Performing Arts, Business Studies, Ghanaian Languages, Arabic, French |
| Science Electives      | Agriculture, Biology, Chemistry, Computing, Physics, Additional Mathematics, PEH Elective, Agricultural Science |

#### 4.4.3 Business

| Category             | Subjects |
| -------------------- | -------- |
| Core                 | Mathematics, Social Studies, English Language, General Science, PEH Core |
| Business Electives   | Business Studies, Business Management, Accounting, Economics, ICT, Additional Mathematics |
| Additional Electives | Geography, Government, History, Religious Studies, Literature in English, Applied Technology, Computing, Design & Communication Technology, Art and Design Foundation, Art and Design Studio, Home Economics, Performing Arts, Ghanaian Languages, Arabic, French |
| Science Electives    | Agriculture, Biology, Chemistry, Physics, PEH Elective, Agricultural Science |

Business has year-sensitive subject rules:

| Year      | Business Structure |
| --------- | ------------------ |
| SHS1      | `business_studies` |
| SHS2–SHS3 | `business_management` + `accounting` |
| SHS2–SHS3 extras | Choose from `economics`, `ict`, `additional_mathematics` |

For the database, model Accounting as one subject. Strands such as Financial Accounting and Cost Accounting can be added beneath it.

#### 4.4.4 Applied Technology

| Category                     | Subjects |
| ---------------------------- | -------- |
| Core                         | Mathematics, Social Studies, English Language, General Science, PEH Core |
| Applied Technology Electives | Design & Communication Technology, Applied Technology — Automobile and Metal Technology, Applied Technology — Building Construction and Wood Technology, Applied Technology — Electrical and Electronic Technology, ICT, Physics, Additional Mathematics, Art and Design Foundation |
| Additional Electives         | Agriculture, Biology, Chemistry, Computing, PEH Elective, Home Economics, Business Studies, Art and Design Studio, Performing Arts, Agricultural Science |
| Humanities Electives         | Geography, Economics, Government, History, Religious Studies, Literature in English, Ghanaian Languages, Arabic, French |

#### 4.4.5 Home Economics

| Category                 | Subjects |
| ------------------------ | -------- |
| Core                     | Mathematics, Social Studies, English Language, General Science, PEH Core |
| Home Economics Electives | Home Economics, Biology, Design & Communication Technology, PEH Elective, Agriculture |
| Additional Electives     | Applied Technology, Business Studies, Art and Design Foundation, Art and Design Studio, Performing Arts, Chemistry, Physics, Additional Mathematics, ICT, Agricultural Science |
| Humanities Electives     | Geography, Government, History, Religious Studies, Literature in English, Ghanaian Languages, Arabic, French, Economics, Computing |

Home Economics contains strands such as Management in Living, Clothing and Textiles, and Food and Nutrition.

#### 4.4.6 Art

| Category             | Subjects |
| -------------------- | -------- |
| Core                 | Mathematics, Social Studies, English Language, General Science, PEH Core |
| Art Electives        | Art and Design Foundation, Art and Design Studio, Performing Arts, Design & Communication Technology, ICT |
| Additional Electives | Applied Technology, Home Economics, Business Studies, Economics, Geography, Government, History, Religious Studies, Literature in English, Ghanaian Languages, Arabic, French |
| Science Electives    | Agriculture, Biology, Chemistry, Computing, Physics, Additional Mathematics, PEH Elective, Agricultural Science |

#### 4.4.7 Agriculture

| Category                 | Subjects |
| ------------------------ | -------- |
| Core                     | Mathematics, Social Studies, English Language, General Science, PEH Core |
| Agriculture Electives    | Agriculture, Chemistry, Physics, Biology, Computing, Additional Mathematics |
| Additional Electives     | ICT, Applied Technology, Home Economics, Business Studies, RME, Art and Design Foundation, Art and Design Studio, Design & Communication Technology, Performing Arts, Ghanaian Languages, French, Arabic |
| Humanities Electives     | Economics, Geography, Government, History, Literature in English, Religious Studies |

If Agriculture learners select **Chemistry, Physics, and Biology**, they may be exempted from General Science under the applicable subject-combination rule.

#### 4.4.8 Languages

| Category             | Subjects |
| -------------------- | -------- |
| Core                 | Mathematics, Social Studies, English Language, General Science, PEH Core |
| Languages Electives  | Ghanaian Languages, French, Arabic, Literature in English |
| Additional Electives | ICT, Applied Technology, Home Economics, Business Studies, Economics, Geography, Government, History, Religious Studies, Art and Design Foundation, Art and Design Studio, Design & Communication Technology, Performing Arts |
| Science Electives    | Agriculture, Biology, Chemistry, Computing, Physics, Additional Mathematics, PEH Elective, Agricultural Science |

#### 4.4.9 STEM — Designated STEM Schools Only

| Category             | Subjects |
| -------------------- | -------- |
| Core                 | Mathematics, Social Studies, English Language, PEH Core |
| STEM Electives       | Engineering, Biomedical Science, Aviation & Aerospace, Agriculture, Manufacturing, Robotics, Chemistry, Biology, Physics, Additional Mathematics, Computing, PEH Elective |
| Additional Electives | ICT, Applied Technology, Home Economics, Business Studies, Art and Design Foundation, Art and Design Studio, Performing Arts, Agricultural Science |
| Humanities Electives | Economics, Geography, Government, History, Religious Studies, Literature in English, Ghanaian Languages, Arabic, French |

The STEM pathway is available only to schools designated to offer it.

#### Complete SHS Subject Catalogue

Seed the following SHS learning units. Pathway rules determine which subjects a learner can select and see.

| Slug                                              | Subject |
| ------------------------------------------------- | ------- |
| `english`                                         | English Language |
| `mathematics`                                     | Mathematics |
| `social_studies`                                  | Social Studies |
| `general_science`                                 | General Science |
| `peh_core`                                        | Physical Education and Health — Core |
| `peh_elective`                                    | Physical Education and Health — Elective |
| `intervention_english`                            | Intervention English |
| `intervention_mathematics`                        | Intervention Mathematics |
| `agriculture`                                     | Agriculture |
| `agricultural_science`                            | Agricultural Science |
| `additional_mathematics`                          | Additional Mathematics |
| `biology`                                         | Biology |
| `chemistry`                                       | Chemistry |
| `physics`                                         | Physics |
| `computing`                                       | Computing |
| `ict`                                             | ICT |
| `robotics`                                        | Robotics |
| `engineering`                                     | Engineering |
| `aviation_aerospace`                              | Aviation & Aerospace |
| `biomedical_science`                              | Biomedical Science |
| `manufacturing`                                   | Manufacturing |
| `economics`                                       | Economics |
| `geography`                                       | Geography |
| `government`                                      | Government |
| `history`                                         | History |
| `religious_studies`                               | Religious Studies |
| `rme`                                             | Religious and Moral Education |
| `literature_in_english`                           | Literature in English |
| `ghanaian_languages`                              | Ghanaian Languages |
| `french`                                          | French |
| `arabic`                                          | Arabic |
| `business_studies`                                | Business Studies |
| `business_management`                             | Business Management |
| `accounting`                                      | Accounting |
| `applied_technology`                              | Applied Technology |
| `applied_technology_auto_metal`                   | Applied Technology — Automobile and Metal Technology |
| `applied_technology_building_wood`                | Applied Technology — Building Construction and Wood Technology |
| `applied_technology_electrical_electronic`        | Applied Technology — Electrical and Electronic Technology |
| `design_communication_technology`                 | Design & Communication Technology |
| `home_economics`                                  | Home Economics |
| `art_design_foundation`                           | Art and Design Foundation |
| `art_design_studio`                               | Art and Design Studio |
| `performing_arts`                                 | Performing Arts |

#### SHS Developer Model

Do not model SHS with `LearningUnit` alone. Add `LearningPathway` and explicit pathway subject rules.

```ts
LearningPathway {
  id
  slug              // science, general_arts, business, etc.
  name
  levelGroup        // SHS
  isStemOnly        // true only for the designated STEM pathway
  isActive
}
```

```ts
LearningUnit {
  id
  slug
  name
  learningType      // LEARNING_AREA | SUBJECT
  levelGroup        // KINDERGARTEN | PRIMARY | JHS | SHS
  fromClass
  toClass
  category          // CORE | ELECTIVE | INTERVENTION | PATHWAY_CORE | ADDITIONAL
  isActive
}
```

```ts
PathwaySubjectRule {
  id
  pathwayId
  learningUnitId
  ruleGroup         // CORE | PATHWAY_ELECTIVE | ADDITIONAL_ELECTIVE | SCIENCE_ELECTIVE | HUMANITIES_ELECTIVE
  minSelect
  maxSelect
  required
  fromClass         // SHS1
  toClass           // SHS3
}
```

Business year-sensitive rules must include:

```ts
// SHS1
{
  pathway: "business",
  subject: "business_studies",
  required: true,
  fromClass: "SHS1",
  toClass: "SHS1"
}

// SHS2–SHS3
{
  pathway: "business",
  subject: "business_management",
  required: true,
  fromClass: "SHS2",
  toClass: "SHS3"
}

{
  pathway: "business",
  subject: "accounting",
  required: true,
  fromClass: "SHS2",
  toClass: "SHS3"
}
```

#### SHS Onboarding and Availability Rules

For SHS, ask the learner:

1. What class are you in? — SHS1, SHS2, or SHS3
2. What learning area / pathway are you offering?
3. What subjects are you offering?

Then show only subjects valid for the learner’s **class + pathway + school availability**.

---

## 5. CLASS-SCOPED CONTENT RULE (MANDATORY)

Every topic, lesson, and practice item must be tied to **one class level**.

### Required rule

> A learner in **B2** can only see **B2 content**, even within the same subject.

### Minimum data requirement

```ts
Topic {
  id
  learningUnitId     // subject or learning area
  classLevelCode     // KG1, B2, JHS1, etc.
}

Lesson {
  id
  topicId
  classLevelCode
}

PracticeSet {
  id
  topicId
  classLevelCode
}
```

Filtering logic:

* Current class → full access
* Past classes → revision mode
* Future classes → locked

---

## 6. REAL-WORLD ACADEMIC PROGRESSION (CORE LOGIC)

### 6.1 Principle

Learnda must mirror **real schooling progression**.

> Learners advance **only when the academic year advances**.

---

### 6.2 Academic Profile (REQUIRED)

```ts
UserAcademicProfile {
  userId
  levelGroup
  classLevel
  academicYear      // e.g. "2025/2026"
  term              // Term 1 | Term 2 | Term 3
  status            // ACTIVE | PROMOTED | REPEATED
  autoProgression   // true
}
```

---

### 6.3 Access Rules

For a learner in **Basic 3**:

* ✅ Access: KG → B3
* ❌ Locked: B4 → SHS3

UI must show:

* 🔒 Locked future levels
* 🕘 “Available next academic year”

---

### 6.4 Promotion Logic

Promotion occurs **only at end of academic year**.

Examples:

```
KG2 → B1
B3 → B4
JHS3 → SHS1
```

Conditions:

* Academic year completed
* Admin / parent confirmation
* Optional assessment threshold

Learners cannot self-promote.

---

### 6.5 Manual Overrides

Only:

* Admin
* Parent account
* School account (future)

All overrides must be logged with reason.

---

## 7. FEATURE GATING BY LEVEL

| Feature        | KG | Primary  | JHS        | SHS         |
| -------------- | -- | -------- | ---------- | ----------- |
| Exams          | ❌  | ⚠️ Light  | ✅          | ✅           |
| Quizzes        | ❌  | ✅        | ✅          | ✅           |
| Community      | ❌  | ❌        | ⚠️ Limited  | ⚠️ Limited   |
| Messaging      | ❌  | ❌        | ❌          | ⚠️ Optional  |
| Audio Lessons  | ✅  | ✅        | ✅          | ✅           |
| Animations     | ✅  | ✅        | ✅          | ✅           |
| Offline Access | ✅  | ✅        | ✅          | ✅           |

---

## 8. UI / UX RULES

### Kindergarten

* Big icons
* Tap-to-listen
* No text walls
* Game-like flow

### Primary

* Simple language
* Visual learning
* Gentle assessments

### JHS / SHS

* Structured lessons
* Exam prep
* Practice-heavy

---

## 9. NAVIGATION

Base navigation:

* Home
* Learn
* Practice
* My Space
* More

Rename:

* Courses → Subjects / Learning Areas
* Personal Learning Space → My Space

---

## 10. REBRANDING (GLOBAL)

Agent must remove **all Sharether identity**:

* Names
* Logos
* Colors
* Meta tags
* Emails
* Package IDs
* Storage folders

Repo search `"Sharether"` → **0 results**

---

## 11. DATA STRATEGY

* Separate Learnda database
* Fresh seed data only
* No Sharether data reuse

---

## 12. VALIDATION CHECKLIST

Before completion:

* ✅ No `P1–P6`
* ✅ KG restricted correctly
* ✅ Computing & French visible in B1–B3 (class-scoped)
* ✅ JHS subjects seeded for JHS1–JHS3 with class-scoped content
* ✅ All SHS pathways, subjects, and year rules seeded
* ✅ SHS subjects filtered by class + pathway + school availability
* ✅ Learners locked to academic year
* ✅ Promotion logic enforced
* ✅ No Sharether identity, data, or traces remain
* ✅ App builds cleanly

---

## 13. EXECUTION ORDER (STRICT)

1. Rebrand
2. Add level + class models
3. Seed curriculum
4. Add SHS pathways and subject rules
5. Implement class-scoped content
6. Add academic profile
7. Lock progression
8. Feature gating
9. UI refactor
10. QA & cleanup

---

## 14. DEFINITION OF DONE

Learnda is complete when:

* It feels like a **real Ghanaian school system**
* Learners grow year-by-year
* Kids are protected
* Parents trust it
* No Sharether traces remain

---

## FINAL LOCKED STATEMENT

> Learnda follows Ghana’s real education timeline.
> Subjects are taught **only at the learner’s class level**.
> SHS subjects are governed by **pathway, class, and school availability**.
> Progression happens **by academic year**, not by choice.

---
