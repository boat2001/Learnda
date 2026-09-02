/**
 * Copy files from uploads/resources/eduvhibe-notes into
 * uploads/resources/notes/sem-2/{level}/{group}/{slug}/ using filename heuristics.
 * Does not delete sources. Skips copy if same size+name already at destination.
 */
const fs = require('fs');
const path = require('path');

const RESOURCES = path.join(__dirname, '../../uploads/resources');
const SOURCE = path.join(RESOURCES, 'eduvhibe-notes');
const DEST_ROOT = path.join(RESOURCES, 'notes/sem-2');

/** @type {[RegExp, string][]} Order matters — first match wins. */
const RULES = [
  [/hiv|aids|endemic/i, '100/core/hiv-aids'],
  [/ebs\s*135|ein051|english language studies i|en051sw|^english language 1\.pdf$/i, '100/core/eng-stud-1'],
  [/ebs\s*108|the use of english/i, '100/core/eng-stud-1'],
  [/ghanaian language|ghanian language|cultural studies|g\.language as a medium/i, '100/core/ghan-lang-cult-stud'],
  [/ebs\s*149|lit in eng|studies in poetry/i, '100/eng/lit-eng-2'],
  [/woman in her prime|in the chest of a woman/i, '100/eng/prose-fict'],
  [/written literat|writ.*liter/i, '100/ghan/writ-lit-ghan-lang'],
  [/ebs\s*132|general chemistry/i, '100/sci/gen-chem'],
  [/biology note|general biology/i, '200/sci/gen-bio-theo-2'],
  [/general physics/i, '100/sci/gen-phys-theo'],
  [/computer laboratory|lab management/i, '100/ict/learn-theo'],
  [/computer literacy|comput.*literacy/i, '100/ict/off-suit'],
  [/calcI|calculus/i, '100/math/trig'],
  [/trigonometry and geometry|^trigonometry/i, '100/math/geo-trig'],
  [/natural environment|global studies/i, '100/soc/nat-env'],
  [/physical.*social relation/i, '100/soc/phys-soc-rel'],
  [/performance art|performing art unit/i, '100/perf/nat-perf-arts'],
  [/african traditional|philosophical.*religi/i, '100/rme/afri-tra-rel'],
  [/religious experience/i, '100/rme/rel-exp'],

  [/ebs\s*234|assessment in basic|full notes on assessment/i, '200/core/assess-basic'],
  [/educating individuals|diverse learning needs|educating individual/i, '200/core/educ-ind'],
  [/general principles and methods|general principles.*teaching|general curriculum studies/i, '200/core/gen-prin-meth'],
  [/national teaching standard|^nts\.pdf$/i, '200/core/gen-prin-meth'],
  [/lesson plan/i, '200/core/gen-prin-meth'],
  [/principles and practice of education/i, '200/core/gen-prin-meth'],

  [/ebs\s*280|introduction to semantics/i, '200/eng/intro-sem'],
  [/curriculum studies in english|curricullum studies in english|ebs\s*239|english curriculum/i, '200/eng/cur-eng'],
  [/forms and functions|english clause|dangling modifier|concord|sentence.*its parts/i, '200/eng/func-clause'],
  [/english studies ii|enGLISH STUDIES II/i, '200/eng/cur-eng'],
  [/studies in drama/i, '200/eng/stud-shake'],
  [/shakespeare/i, '200/eng/stud-shake'],

  [/ebs\s*241|curriculum studies in twi|curriculum.*twi|edited curr of gh lang/i, '200/ghan/cur-ghan-lang'],
  [/morphology/i, '200/ghan/ghan-lang-cult-morph'],

  [/methods of teaching science/i, '200/sci/meth-sci'],

  [/database management/i, '200/ict/net-comp'],
  [/designing instructional|instructional material/i, '200/ict/design-inst-mat'],

  [/methods of teaching mathematics/i, '200/math/cur-math'],
  [/psychological basis.*mathematics/i, '200/math/psy-bas-teach-math'],

  [/curriculum studies in social|ebs\s*248.*social studies/i, '200/soc/cur-soc'],
  [/environmental ethics/i, '200/soc/envi-eth'],
  [/social environment/i, '200/soc/soc-env'],
  [/social studies as an integrated|social structure unit|unit 3 social structure|unit 4 social structure/i, '200/soc/soc-sub'],
  [/citizenship education/i, '200/soc/soc-env'],
  [/ebs\s*279|foundation of sociology/i, '200/soc/soc-env'],
  [/human.?land.*ghana|ebs\s*157/i, '100/soc/nat-env'],

  [/curriculum studies in rme|cur-rme/i, '200/rme/cur-rme'],
  [/morality.*social values|mor-afri/i, '200/rme/mor-afri'],
  [/sociological perspectives/i, '200/rme/socio-rme'],

  [/curriculum.*performing|cur-perf/i, '200/perf/cur-perf-arts'],

  [/educational statistics|edu-stat|educational-statistics/i, '300/core/edu-stat'],
  [/introduction to guidance|guidance and counseling/i, '300/core/intro-guide'],
  [/school management|administration/i, '300/core/sch-man'],
  [/gender.*writing|studies in literature/i, '300/core/stud-lit'],

  [/english.*multilingual|english as multilingual/i, '300/eng/eng-mult-cont'],

  [/ebs\s*347|population and socio/i, '300/soc/gen-dev-africa'],
  [/population.*ghana/i, '300/soc/gen-dev-africa'],

  [/troubleshooting|pc maintenance/i, '300/ict/pc-man-troub'],

  [/core-eps|educational.?research|eps.?203/i, '_import-eduvhibe/edu-research'],

  [/in-service|ebs\s*355/i, '_import-eduvhibe/in-service'],
  [/information literacy|infolit/i, '100/ict/off-suit'],
  [/info\.?\s*lit\.?\s*skills/i, '100/ict/off-suit'],

  [/child and adolescent|child and adolt/i, '200/core/educ-ind']
];

function destForFile(name) {
  const base = path.basename(name);
  for (const [test, rel] of RULES) {
    if (test.test(base)) return rel;
  }
  return '_import-eduvhibe/unclassified';
}

function uniqueDest(filePath) {
  if (!fs.existsSync(filePath)) return filePath;
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  let i = 1;
  let candidate;
  do {
    candidate = path.join(dir, `${base}_eduvhibe${i === 1 ? '' : i}${ext}`);
    i += 1;
  } while (fs.existsSync(candidate) && i < 200);
  return candidate;
}

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error('Missing source:', SOURCE);
    process.exit(1);
  }
  const files = fs.readdirSync(SOURCE, { withFileTypes: true }).filter((d) => d.isFile());
  let copied = 0;
  let skipped = 0;
  const summary = {};

  for (const ent of files) {
    const src = path.join(SOURCE, ent.name);
    const relDir = destForFile(ent.name);
    const dir = path.join(DEST_ROOT, relDir);
    fs.mkdirSync(dir, { recursive: true });

    let dest = path.join(dir, ent.name);
    const stSrc = fs.statSync(src);

    if (fs.existsSync(dest)) {
      const stDest = fs.statSync(dest);
      if (stDest.size === stSrc.size) {
        skipped += 1;
        continue;
      }
      dest = uniqueDest(dest);
    }

    fs.copyFileSync(src, dest);
    copied += 1;
    summary[relDir] = (summary[relDir] || 0) + 1;
  }

  console.log(JSON.stringify({ copied, skipped, byDir: summary }, null, 2));
}

main();
