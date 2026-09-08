import React, { useRef } from 'react';
import { useLandingSnap } from './useLandingSnap';

function LandingDeck({ children }) {
  const deckRef = useRef(null);
  useLandingSnap(deckRef);

  return (
    <div className="app-landing-deck" ref={deckRef}>
      {children}
    </div>
  );
}

export default LandingDeck;
