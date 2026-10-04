/**
 * The built-in quotes. Bundled, never fetched: no network, no privacy question, no
 * service to outlive (docs/03-widget-api.md).
 *
 * Every one is public domain, in an old translation where it is a translation, and
 * attributed to someone who demonstrably wrote or said it. The internet's favourite
 * quotes are mostly misattributed, so a quote that is only *said* to be Einstein's
 * or Twain's stays out. Lives in the widget's lazy chunk, off the critical path.
 */

export interface Quote {
  text: string;
  author: string;
}

export const QUOTES: readonly Quote[] = [
  {
    text: 'Waste no more time arguing about what a good man should be. Be one.',
    author: 'Marcus Aurelius',
  },
  {
    text: 'If it is not right, do not do it; if it is not true, do not say it.',
    author: 'Marcus Aurelius',
  },
  {
    text: 'Such as are thy habitual thoughts, such also will be the character of thy mind; for the soul is dyed by the thoughts.',
    author: 'Marcus Aurelius',
  },
  {
    text: 'Look round at the courses of the stars, as if thou wert going along with them.',
    author: 'Marcus Aurelius',
  },
  { text: 'We suffer more often in imagination than in reality.', author: 'Seneca' },
  { text: 'While we are postponing, life speeds by.', author: 'Seneca' },
  {
    text: 'It is not that we have a short time to live, but that we waste a lot of it.',
    author: 'Seneca',
  },
  {
    text: 'Begin at once to live, and count each separate day as a separate life.',
    author: 'Seneca',
  },
  {
    text: 'As is a tale, so is life: not how long it is, but how good it is, is what matters.',
    author: 'Seneca',
  },
  {
    text: 'Hold every hour in your grasp. Lay hold of to-day’s task, and you will not need to depend so much upon to-morrow’s.',
    author: 'Seneca',
  },
  { text: 'No man is free who is not master of himself.', author: 'Epictetus' },
  {
    text: 'First say to yourself what you would be; and then do what you have to do.',
    author: 'Epictetus',
  },
  {
    text: 'Men are disturbed not by the things which happen, but by the opinions about the things.',
    author: 'Epictetus',
  },
  {
    text: 'The journey of a thousand miles begins with a single step.',
    author: 'Lao Tzu',
  },
  {
    text: 'Knowing others is intelligence; knowing yourself is true wisdom.',
    author: 'Lao Tzu',
  },
  {
    text: 'He who knows that enough is enough will always have enough.',
    author: 'Lao Tzu',
  },
  { text: 'The unexamined life is not worth living.', author: 'Socrates' },
  { text: 'Happiness depends upon ourselves.', author: 'Aristotle' },
  {
    text: 'Patience and time do more than strength or passion.',
    author: 'Jean de La Fontaine',
  },
  {
    text: 'I went to the woods because I wished to live deliberately.',
    author: 'Henry David Thoreau',
  },
  {
    text: 'Our life is frittered away by detail. Simplify, simplify.',
    author: 'Henry David Thoreau',
  },
  {
    text: 'Rather than love, than money, than fame, give me truth.',
    author: 'Henry David Thoreau',
  },
  {
    text: 'Adopt the pace of nature: her secret is patience.',
    author: 'Ralph Waldo Emerson',
  },
  { text: 'Nothing can bring you peace but yourself.', author: 'Ralph Waldo Emerson' },
  {
    text: 'Trust thyself: every heart vibrates to that iron string.',
    author: 'Ralph Waldo Emerson',
  },
  {
    text: 'Finish each day and be done with it. You have done what you could.',
    author: 'Ralph Waldo Emerson',
  },
  {
    text: 'Hope is the thing with feathers that perches in the soul.',
    author: 'Emily Dickinson',
  },
  { text: 'Forever is composed of nows.', author: 'Emily Dickinson' },
  {
    text: 'To see a World in a Grain of Sand, and a Heaven in a Wild Flower.',
    author: 'William Blake',
  },
  { text: 'Well done is better than well said.', author: 'Benjamin Franklin' },
  { text: 'Lost time is never found again.', author: 'Benjamin Franklin' },
  {
    text: 'Great things are done by a series of small things brought together.',
    author: 'Vincent van Gogh',
  },
  { text: 'The best way out is always through.', author: 'Robert Frost' },
  {
    text: 'The woods are lovely, dark and deep, but I have promises to keep, and miles to go before I sleep.',
    author: 'Robert Frost',
  },
  {
    text: 'He who has a why to live can bear almost any how.',
    author: 'Friedrich Nietzsche',
  },
  {
    text: 'One must still have chaos in oneself to be able to give birth to a dancing star.',
    author: 'Friedrich Nietzsche',
  },
  {
    text: 'Doubt is not a pleasant condition, but certainty is absurd.',
    author: 'Voltaire',
  },
  { text: 'The best is the enemy of the good.', author: 'Voltaire' },
  { text: 'We must cultivate our garden.', author: 'Voltaire' },
  {
    text: 'There is nothing either good or bad, but thinking makes it so.',
    author: 'William Shakespeare',
  },
  {
    text: 'We know what we are, but know not what we may be.',
    author: 'William Shakespeare',
  },
  { text: 'Brevity is the soul of wit.', author: 'William Shakespeare' },
  { text: 'Fall seven times, stand up eight.', author: 'Japanese proverb' },
  { text: 'Little by little, one travels far.', author: 'Spanish proverb' },
  {
    text: 'Habit is habit, and not to be flung out of the window by any man, but coaxed down-stairs a step at a time.',
    author: 'Mark Twain',
  },
  {
    text: 'Courage is resistance to fear, mastery of fear — not absence of fear.',
    author: 'Mark Twain',
  },
  {
    text: 'Rest is not idleness, and to lie sometimes on the grass under trees on a summer’s day, listening to the murmur of the water, or watching the clouds float across the sky, is by no means a waste of time.',
    author: 'John Lubbock',
  },
  {
    text: 'In every walk with nature one receives far more than he seeks.',
    author: 'John Muir',
  },
  { text: 'The mountains are calling and I must go.', author: 'John Muir' },
  {
    text: 'I am not afraid of storms, for I am learning how to sail my ship.',
    author: 'Louisa May Alcott',
  },
  {
    text: 'What do we live for, if it is not to make life less difficult to each other?',
    author: 'George Eliot',
  },
  {
    text: 'The world is full of magic things, patiently waiting for our wits to grow sharper.',
    author: 'Eden Phillpotts',
  },
  {
    text: 'Life can only be understood backwards; but it must be lived forwards.',
    author: 'Søren Kierkegaard',
  },
  {
    text: 'To live is the rarest thing in the world. Most people exist, that is all.',
    author: 'Oscar Wilde',
  },
  {
    text: 'We are all in the gutter, but some of us are looking at the stars.',
    author: 'Oscar Wilde',
  },
  {
    text: 'Experience is the name every one gives to their mistakes.',
    author: 'Oscar Wilde',
  },
  { text: 'I exist as I am, that is enough.', author: 'Walt Whitman' },
  {
    text: 'Do what you can, with what you have, where you are.',
    author: 'Theodore Roosevelt',
  },
  {
    text: 'Far and away the best prize that life offers is the chance to work hard at work worth doing.',
    author: 'Theodore Roosevelt',
  },
  {
    text: 'One ought, every day at least, to hear a little song, read a good poem, see a fine picture, and, if it were possible, to speak a few reasonable words.',
    author: 'Johann Wolfgang von Goethe',
  },
  {
    text: 'Knowing is not enough; we must apply. Willing is not enough; we must do.',
    author: 'Johann Wolfgang von Goethe',
  },
  {
    text: 'There is no duty we so much underrate as the duty of being happy.',
    author: 'Robert Louis Stevenson',
  },
  {
    text: 'Let us be grateful to people who make us happy; they are the charming gardeners who make our souls blossom.',
    author: 'Marcel Proust',
  },
];
