import React, { useMemo, useState } from 'react';
import './Eduvhibe.css';

const gradePointOptions = [
  { label: 'A (4.0)', value: 4.0 },
  { label: 'B+ (3.5)', value: 3.5 },
  { label: 'B (3.0)', value: 3.0 },
  { label: 'C+ (2.5)', value: 2.5 },
  { label: 'C (2.0)', value: 2.0 },
  { label: 'D+ (1.5)', value: 1.5 },
  { label: 'D (1.0)', value: 1.0 },
  { label: 'F (0)', value: 0 },
];

const initialSemesters = () => ({
  1: [],
  2: [],
  3: [],
  4: [],
  5: [],
  6: [],
  7: [],
  8: [],
});

const formatGpa = (courses) => {
  if (!courses.length) return '0.00';

  const totalCredits = courses.reduce((sum, course) => sum + Number(course.credit || 0), 0);
  const totalGradePoints = courses.reduce(
    (sum, course) => sum + (Number(course.credit || 0) * Number(course.grade || 0)),
    0
  );

  if (!totalCredits) return '0.00';
  return (totalGradePoints / totalCredits).toFixed(2);
};

export default function CGPATrackerTab() {
  const [semesters, setSemesters] = useState(initialSemesters);
  const [activeSemester, setActiveSemester] = useState(1);
  const [courseName, setCourseName] = useState('');
  const [courseCredit, setCourseCredit] = useState('3');
  const [courseGrade, setCourseGrade] = useState('4');
  const [semesterGpa, setSemesterGpa] = useState('0.00');
  const [cumulativeGpa, setCumulativeGpa] = useState('0.00');

  const activeSemesterCourses = useMemo(
    () => semesters[activeSemester] || [],
    [activeSemester, semesters]
  );
  const activeCredits = useMemo(
    () => activeSemesterCourses.reduce((sum, course) => sum + Number(course.credit || 0), 0),
    [activeSemesterCourses]
  );
  const totalCourses = useMemo(
    () => Object.values(semesters).reduce((sum, semester) => sum + semester.length, 0),
    [semesters]
  );
  const totalCredits = useMemo(
    () =>
      Object.values(semesters)
        .flat()
        .reduce((sum, course) => sum + Number(course.credit || 0), 0),
    [semesters]
  );

  const addCourse = () => {
    const name = courseName.trim();
    const credit = Number.parseFloat(courseCredit);
    const grade = Number.parseFloat(courseGrade);

    if (!name || Number.isNaN(credit) || credit <= 0) {
      window.alert('Please enter a valid course name and credit hours.');
      return;
    }

    const nextSemesters = {
      ...semesters,
      [activeSemester]: [
        ...activeSemesterCourses,
        { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, name, credit, grade },
      ],
    };

    setSemesters(nextSemesters);
    setCourseName('');
    setCourseCredit('3');
  };

  const removeCourse = (courseId) => {
    const nextSemesters = {
      ...semesters,
      [activeSemester]: activeSemesterCourses.filter((course) => course.id !== courseId),
    };
    setSemesters(nextSemesters);
  };

  const calculateSemesterGpa = () => {
    if (!activeSemesterCourses.length) {
      window.alert('Please add at least one course to calculate GPA.');
      return;
    }
    setSemesterGpa(formatGpa(activeSemesterCourses));
  };

  const calculateCumulativeGpa = () => {
    const allCourses = Object.values(semesters).flat();
    if (!allCourses.length) {
      window.alert('Please add courses to at least one semester to calculate CGPA.');
      return;
    }
    setCumulativeGpa(formatGpa(allCourses));
  };

  const resetCurrentSemester = () => {
    if (!window.confirm('Are you sure you want to reset all courses in this semester?')) return;
    setSemesters({
      ...semesters,
      [activeSemester]: [],
    });
    setSemesterGpa('0.00');
  };

  const resetAllSemesters = () => {
    if (!window.confirm('Are you sure you want to reset ALL semesters? This cannot be undone.')) return;
    setSemesters(initialSemesters());
    setSemesterGpa('0.00');
    setCumulativeGpa('0.00');
  };

  return (
    <div className="cgpa-container eduvhibe-cgpa-tab">
      <div className="cgpa-grid">
        <section className="cgpa-card">
          <h3 className="cgpa-card-title">Semester GPA Calculator</h3>
          <p className="cgpa-subtitle">Track each semester course-by-course and calculate GPA instantly.</p>

          <div className="semester-tabs">
            {Array.from({ length: 8 }, (_, index) => index + 1).map((semester) => (
              <button
                key={semester}
                type="button"
                className={`sem-tab-btn ${activeSemester === semester ? 'active-sem' : ''}`}
                onClick={() => setActiveSemester(semester)}
              >
                Sem {semester}
              </button>
            ))}
          </div>

          <div className="eduvhibe-cgpa-semester-summary">
            <div>
              <span>Semester Courses</span>
              <strong>{activeSemesterCourses.length}</strong>
            </div>
            <div>
              <span>Semester Credits</span>
              <strong>{activeCredits}</strong>
            </div>
            <div>
              <span>Total Courses</span>
              <strong>{totalCourses}</strong>
            </div>
          </div>

          <div className="course-input-row eduvhibe-cgpa-form-shell">
            <input
              type="text"
              placeholder="Course Name"
              className="cgpa-input"
              value={courseName}
              onChange={(event) => setCourseName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') addCourse();
              }}
            />
            <input
              type="number"
              placeholder="Credits"
              className="cgpa-input"
              min="1"
              max="6"
              value={courseCredit}
              onChange={(event) => setCourseCredit(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') addCourse();
              }}
            />
            <select
              className="cgpa-input"
              value={courseGrade}
              onChange={(event) => setCourseGrade(event.target.value)}
            >
              {gradePointOptions.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button type="button" className="add-course-btn eduvhibe-cgpa-add-btn" onClick={addCourse}>
              Add
            </button>
          </div>

          <ul className="added-courses-list">
            {activeSemesterCourses.length === 0 ? (
              <li className="eduvhibe-cgpa-empty-row">
                <strong>No courses added for Semester {activeSemester}.</strong>
              </li>
            ) : (
              activeSemesterCourses.map((course) => (
                <li className="course-list-item" key={course.id}>
                  <span className="eduvhibe-cgpa-course-name">
                    <strong>{course.name}</strong>
                  </span>
                  <span className="eduvhibe-cgpa-course-credits">{course.credit}</span>
                  <span className="eduvhibe-cgpa-course-grade">{course.grade.toFixed(1)}</span>
                  <button
                    type="button"
                    onClick={() => removeCourse(course.id)}
                    className="eduvhibe-cgpa-remove-btn"
                  >
                    Remove
                  </button>
                </li>
              ))
            )}
          </ul>

          <div className="cgpa-action-row">
            <button type="button" className="add-course-btn" onClick={calculateSemesterGpa}>
              Calculate GPA
            </button>
            <button type="button" className="calc-btn reset-btn" onClick={resetCurrentSemester}>
              Reset Semester
            </button>
          </div>

          <div className="result-card gradient-box">
            <h4>Semester GPA</h4>
            <div className="huge-number">{semesterGpa}</div>
            <p>Based on your current semester entries.</p>
          </div>
        </section>

        <section className="cgpa-card main-cgpa-box gradient-box">
          <h4>Cumulative GPA (CGPA)</h4>
          <p>Average of all completed semesters.</p>
          <div className="huge-number">{cumulativeGpa}</div>
          <p>{totalCredits} total credits recorded</p>

          <div className="grade-legend">
            <div>
              <strong>1st class</strong>
              <div>3.6-4.0</div>
            </div>
            <div>
              <strong>2nd class-U</strong>
              <div>3.0-3.5</div>
            </div>
            <div>
              <strong>2nd class-L</strong>
              <div>2.5-2.9</div>
            </div>
            <div>
              <strong>3rd class</strong>
              <div>2.0-2.4</div>
            </div>
            <div>
              <strong>Pass</strong>
              <div>1.0-1.9</div>
            </div>
            <div>
              <strong>IC</strong>
              <div>0</div>
            </div>
          </div>

          <div className="cgpa-action-row">
            <button type="button" className="add-course-btn eduvhibe-cgpa-reset-all" onClick={calculateCumulativeGpa}>
              Calculate CGPA
            </button>
            <button type="button" className="calc-btn reset-btn eduvhibe-cgpa-reset-all" onClick={resetAllSemesters}>
              Reset All
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
