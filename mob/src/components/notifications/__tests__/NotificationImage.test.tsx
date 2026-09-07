import React from 'react';
import { StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { fireEvent, renderWithProviders, screen } from '@/__tests__/test-utils';
import { NotificationImage } from '../NotificationImage';

const load = (width: number, height: number) => ({
  cacheType: 'none',
  source: { url: 'https://x/img.png', width, height, mediaType: 'image/png' },
});

describe('NotificationImage', () => {
  it('adopte le ratio réel de l’image (bannière large, en cover)', () => {
    renderWithProviders(<NotificationImage uri="https://x/img.png" />);
    fireEvent(screen.UNSAFE_getByType(Image), 'load', load(1600, 800));
    const img = screen.UNSAFE_getByType(Image);
    expect(StyleSheet.flatten(img.props.style).aspectRatio).toBe(2);
    expect(img.props.contentFit).toBe('cover');
  });

  it('une capture verticale est montrée entière (contain) dans un cadre borné', () => {
    renderWithProviders(<NotificationImage uri="https://x/img.png" />);
    fireEvent(screen.UNSAFE_getByType(Image), 'load', load(1179, 2556));
    const img = screen.UNSAFE_getByType(Image);
    expect(StyleSheet.flatten(img.props.style).aspectRatio).toBe(0.8);
    expect(img.props.contentFit).toBe('contain');
  });
});
