import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { richText } from './rich-text';

describe('richText', () => {
  it('puts elements where the sentence marks them', () => {
    const { container } = render(
      <p>{richText('Press [[key]] to add a widget.', { key: <kbd>E</kbd> })}</p>,
    );
    expect(container.innerHTML).toBe('<p>Press <kbd>E</kbd> to add a widget.</p>');
  });

  it('leaves an unknown marker visible rather than dropping words', () => {
    const { container } = render(<p>{richText('A [[missing]] b', {})}</p>);
    expect(container.textContent).toBe('A [[missing]] b');
  });
});
