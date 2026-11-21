# Grand piano music — short design

**Why:** the synthesized music box sounded toy-like. Picked by ear on a throwaway listening page: **grand piano, hall echo on**.

**What:** all game music plays on the Salamander Grand Piano (Alexander Holm, CC BY 3.0): 30 recorded notes (every third key,
A0–C8, ~2 MB) in `public/piano/`, nearest recording re-pitched for notes in between. The TV downloads them in the background;
the music box plays any note whose recording hasn't arrived. Music goes through a 2.4 s synthetic concert-hall reverb (wet 0.28);
sound effects are unchanged. Up to 40 piano notes ring at once (melody always plays). Three upbeat Mutopia pieces join the
in-game playlist: Sousa's Liberty Bell March, Schubert's Marche militaire No. 1 (four hands), Chopin's Minute Waltz.

**Approaches:** (1) self-hosted Salamander piano (chosen); (2) piano + General MIDI strings / string orchestra / flute (heard,
not chosen); (3) public-domain recordings (bigger, can't follow the game's speed-up as cleanly; not chosen for now).
