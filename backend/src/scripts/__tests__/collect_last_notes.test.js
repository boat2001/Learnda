const { describe, expect, test } = require('@jest/globals');
const collector = require('../collect_last_notes');

describe('last-notes collector helpers', () => {
  test('parses RSS items and decodes entities', () => {
    const [item] = collector.xmlItems(
      '<item><title>Notes &amp; outline</title><link>https://example.edu/a.pdf</link>'
      + '<description><![CDATA[Course notes]]></description></item>'
    );
    expect(item).toEqual({
      title: 'Notes & outline',
      url: 'https://example.edu/a.pdf',
      description: 'Course notes'
    });
  });

  test('extracts only public HTTP document links', () => {
    const html = '<a href="/one.pdf">One</a><a href="javascript:x">Bad</a>'
      + '<a href="https://cdn.example.edu/two.docx?download=1">Two</a>';
    expect(collector.extractDocumentLinks(html, 'https://example.edu/page')).toEqual([
      'https://example.edu/one.pdf',
      'https://cdn.example.edu/two.docx?download=1'
    ]);
  });

  test('parses and unwraps DuckDuckGo result links', () => {
    const target = encodeURIComponent('https://example.edu/course-notes.pdf');
    const html = '<div class="result results_links web-result"><h2>'
      + `<a class="result__a" href="//duckduckgo.com/l/?uddg=${target}&amp;rut=x">Course notes</a>`
      + '</h2><a class="result__snippet">Lecture notes</a><div class="clear"></div></div></div>';
    expect(collector.duckDuckGoItems(html)).toEqual([{
      url: 'https://example.edu/course-notes.pdf',
      title: 'Course notes',
      description: 'Lecture notes'
    }]);
  });

  test('requires the course code or several meaningful title words', () => {
    const course = { code: 'EBS336', title: 'History and Development of Education in Ghana' };
    expect(collector.relevant(course, 'EBS336 lecture notes')).toBe(true);
    expect(collector.relevant(course, 'History Development Education handbook')).toBe(true);
    expect(collector.relevant(course, 'Unrelated chemistry notes')).toBe(false);
  });

  test('rejects a PDF extension without a PDF signature', () => {
    expect(collector.extensionFor('https://example.edu/a.pdf', 'application/pdf', Buffer.from('not pdf'))).toBeNull();
    expect(collector.extensionFor('https://example.edu/a.pdf', 'application/pdf', Buffer.from('%PDF-1.7'))).toBe('.pdf');
  });

  test('parses dry-run and course options', () => {
    expect(collector.parseArgs(['--dry-run', '--course=ebs111'])).toEqual({ dryRun: true, code: 'EBS111' });
  });
});
