import assert from'node:assert/strict';
import{makeInteractiveText,sentenceAudioButton}from'../interactive-english.js';

{
  const html=makeInteractiveText('Students compare evidence.');
  assert.match(html,/data-lookup-word="Students"/);
  assert.match(html,/data-lookup-word="compare"/);
  assert.match(html,/interactive-token/);
}

{
  const html=makeInteractiveText('<b>Access</b> creates memory.',{highlight:['access']});
  assert.match(html,/&lt;b&gt;/);
  assert.match(html,/focus/);
  assert.doesNotMatch(html,/<b>/);
}

{
  const html=sentenceAudioButton('Readers must pause.');
  assert.match(html,/data-speak-text="Readers must pause\."/);
  assert.match(html,/data-speak-lang="en-US"/);
  assert.match(html,/英音/);
}

console.log('interactive-english tests passed');
