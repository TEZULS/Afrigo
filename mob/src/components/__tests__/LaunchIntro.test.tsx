import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { LaunchIntro } from '../LaunchIntro';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('LaunchIntro', () => {
  it('écrit « AfriGo » lettre par lettre derrière le panier, puis se termine', () => {
    const onDone = jest.fn();
    render(<LaunchIntro onDone={onDone} />);

    expect(screen.getByTestId('launch-intro')).toBeTruthy();
    expect(['A', 'f', 'r', 'i', 'G', 'o'].map((l) => screen.getByText(l))).toHaveLength(6);

    // L'animation part une fois le nom mesuré.
    fireEvent(screen.getByLabelText('AfriGo'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 150, height: 50 } },
    });
    expect(onDone).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
