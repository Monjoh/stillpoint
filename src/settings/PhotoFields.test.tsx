import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { asset } from '@/core/assets/__fixtures__/asset';
import { loadImageAsset } from '@/core/assets/image';
import { profileSchema, type BackgroundConfig } from '@/core/config/schema';
import { localAdapter } from '@/core/storage/local';
import { readImagePreview, writeImagePreview } from '@/core/storage/paint-cache';
import { ImageUploadError, prepareImage } from './image-upload';
import { BackgroundFields } from './ThemeSettings';

// jsdom cannot decode or encode an image, so the pipeline is replaced. Its pure
// parts are tested in image-upload.test.ts; what is tested here is what the panel
// does with the result, and in what order.
vi.mock('./image-upload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./image-upload')>()),
  prepareImage: vi.fn(),
}));

const photo = (assetId: string, extra: Partial<BackgroundConfig> = {}) =>
  ({
    kind: 'image',
    assetId,
    fit: 'cover',
    blur: 0,
    dim: 0,
    ...extra,
  }) as BackgroundConfig;

function setup(background: BackgroundConfig = { kind: 'solid', color: '#000' }) {
  const onChangeBackground = vi.fn();
  const profile = profileSchema.parse({ id: 'p1', name: 'Focus', background });
  render(
    <BackgroundFields profile={profile} onChangeBackground={onChangeBackground} />,
  );
  return { onChangeBackground };
}

const file = () => new File(['x'], 'beach.jpg', { type: 'image/jpeg' });

describe('uploading a photo', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(prepareImage).mockReset();
  });

  it('stores the photo and its preview before pointing the background at it', async () => {
    vi.mocked(prepareImage).mockResolvedValue(asset);
    const { onChangeBackground } = setup();

    await userEvent.upload(screen.getByLabelText('Use your own photo'), file());

    await waitFor(() => expect(onChangeBackground).toHaveBeenCalled());
    const next = onChangeBackground.mock.lastCall![0] as BackgroundConfig;
    expect(next).toMatchObject({ kind: 'image', fit: 'cover', blur: 0, dim: 0 });
    if (next.kind !== 'image') return;
    // Both already there by the time the config names them.
    expect(await loadImageAsset(localAdapter, next.assetId)).toEqual(asset);
    expect(readImagePreview(next.assetId)).toEqual(asset.preview);
  });

  it('keeps the fit, blur and dim when a photo is replaced', async () => {
    vi.mocked(prepareImage).mockResolvedValue(asset);
    writeImagePreview('old', asset.preview);
    const { onChangeBackground } = setup(
      photo('old', { fit: 'contain', blur: 12, dim: 0.3 }),
    );

    await userEvent.upload(screen.getByLabelText('Replace photo'), file());

    await waitFor(() => expect(onChangeBackground).toHaveBeenCalled());
    expect(onChangeBackground.mock.lastCall![0]).toMatchObject({
      fit: 'contain',
      blur: 12,
      dim: 0.3,
    });
    expect(onChangeBackground.mock.lastCall![0].assetId).not.toBe('old');
  });

  it('says what went wrong, and changes nothing', async () => {
    vi.mocked(prepareImage).mockRejectedValue(
      new ImageUploadError('That image could not be opened.'),
    );
    const { onChangeBackground } = setup();

    await userEvent.upload(screen.getByLabelText('Use your own photo'), file());

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'That image could not be opened.',
    );
    expect(onChangeBackground).not.toHaveBeenCalled();
  });
});

describe('a photo background', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('offers fit, blur and dim, generated from the schema', () => {
    writeImagePreview('a', asset.preview);
    const { onChangeBackground } = setup(photo('a'));

    expect(screen.getByRole('group', { name: 'Fit' })).toBeTruthy();
    expect(screen.getByLabelText('Blur')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Dim'), { target: { value: '0.4' } });
    expect(onChangeBackground).toHaveBeenCalledWith(photo('a', { dim: 0.4 }));
  });

  it('says so when the photo is not stored on this device', () => {
    setup(photo('gone'));
    expect(screen.getByRole('status').textContent).toMatch(/no longer stored here/);
  });

  // It is a background, just not a gradient; the "none of these" note is for imports.
  it('selects no gradient and does not call itself unknown', () => {
    writeImagePreview('a', asset.preview);
    setup(photo('a'));
    const gradients = screen.getByRole('radiogroup', { name: 'Background' });
    expect(within(gradients).queryByRole('radio', { checked: true })).toBeNull();
    expect(screen.queryByText(/not one of these/)).toBeNull();
  });
});
