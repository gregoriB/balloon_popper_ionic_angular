import {
    AfterViewInit,
    ChangeDetectionStrategy,
    Component,
    HostListener,
    effect,
    signal,
} from '@angular/core';
import { ViewDidLeave } from '@ionic/angular';
import { MovingObjectComponent } from 'src/app/components/moving-object/moving-object.component';

enum InteractableObject {
    BALLOON = 'balloon',
}

const interactionSounds: { [key: string]: string } = {
    [InteractableObject.BALLOON]: '../../../assets/sounds/pop.flac',
};

enum Bgm {
    JAZZ_TRIO,
    JAZZ_HAPPY,
    JAZZ_SWING,
}

const bgms: { [key: string]: string } = {
    [Bgm.JAZZ_TRIO]: '../../../assets/sounds/jazz-trio.mp3',
    [Bgm.JAZZ_HAPPY]: '../../../assets/sounds/jazz-happy.mp3',
    [Bgm.JAZZ_SWING]: '../../../assets/sounds/jazz-swing.mp3',
};

const bgmArr = [
    bgms[Bgm.JAZZ_TRIO],
    bgms[Bgm.JAZZ_HAPPY],
    bgms[Bgm.JAZZ_SWING],
];

const startingBgmSongIndex = Math.floor(Math.random() * bgmArr.length);

function generateRandomBalloon(index: number): LevelObjectConfig {
    const [minSize, maxSize] = [0.7, 0.9];
    const [minStep, maxStep] = [0.15, 0.4];
    const size = Math.max(Math.random() * maxSize, minSize);

    return {
        attrs: {
            id: window.crypto.getRandomValues(new Uint8Array(10)).join(''),
            name: InteractableObject.BALLOON,
            isActive: true,
            basePoints: 10,
        },
        movement: {
            index,
            size: { width: size, height: size + 0.2 },
            step: Math.max(Math.random() * maxStep, minStep),
            startPos: null,
        },
    };
}

const generateNewItems = (count = 5) => {
    return new Array(count)
        .fill(0)
        .map((_, i: number) => generateRandomBalloon(i));
};

const numBalloons = 2;

@Component({
    selector: 'app-play',
    templateUrl: './play.page.html',
    styleUrl: './play.page.scss',
    standalone: true,
    imports: [MovingObjectComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayPage implements ViewDidLeave, AfterViewInit {
    levelObjects = signal<LevelObjectConfig[]>(generateNewItems(numBalloons));
    score = signal<number>(0);
    currentTouch = signal<[number, number]>([0, 0]);
    bgmSongIndex = signal<number>(-1);
    bounds = signal<Bounds>(this.windowBounds);
    computed = signal<number>(3);
    isThrottled = signal(false);

    bgmSong!: HTMLAudioElement;
    interactionSound!: HTMLAudioElement;

    constructor() {
        effect(this.playBgmAudio.bind(this));
    }

    @HostListener('window:resize')
    handleScreenOrientationChange() {
        this.setBounds();
        this.initializeLevelObjects();
    }

    setBounds() {
        this.bounds.set(this.windowBounds);
    }

    get windowBounds(): Bounds {
        return {
            width: [0, window.innerWidth],
            height: [0, window.innerHeight],
        };
    }

    initializeLevelObjects() {
        this.levelObjects.set(generateNewItems(numBalloons));
    }

    isEveryObjectInactive(levelObjects: LevelObjectConfig[]) {
        return levelObjects.every((lo) => !lo.attrs.isActive);
    }

    ngAfterViewInit() {
        if (this.bgmSongIndex() !== -1) return;
        this.bgmSongIndex.set(startingBgmSongIndex);
    }

    ionViewDidLeave() {
        this.bgmSong.pause();
        this.bgmSong.removeEventListener(
            'ended',
            this.incrementBgmSong.bind(this),
        );
    }

    touchPage(event: TouchEvent) {
        const { pageX, pageY } = event.changedTouches[0];
        this.currentTouch.set([pageX, pageY]);
    }

    clickPage(event: MouseEvent) {
        this.currentTouch.set([event.x, event.y]);
    }

    playBgmAudio() {
        this.bgmSong = new Audio(bgmArr[this.bgmSongIndex()]);
        this.bgmSong.play();
        this.bgmSong.addEventListener(
            'ended',
            this.incrementBgmSong.bind(this),
        );
    }

    @HostListener('document:visibilitychange', [
        '$event.target.visibilityState',
    ])
    toggleBgmAudio(visibilityState: 'visible' | 'hidden') {
        if (visibilityState === 'hidden') {
            this.bgmSong.pause();
        }
        if (visibilityState === 'visible') {
            this.playBgmAudio();
        }
    }

    playInteractionAudio(soundName: string) {
        if (this.interactionSound?.duration > 0) {
            this.interactionSound.pause();
        }
        this.interactionSound = new Audio(interactionSounds[soundName]);
        this.interactionSound.play();
    }

    playInflateAudio() {
        const inflateSound = new Audio('../../../assets/sounds/inflate.flac');
        inflateSound.play();
        inflateSound.playbackRate = 4;
    }

    batchedInteractions: ObjectUpdate[] = [];

    interactionEvent(objConfig: ObjectUpdate) {
        if (this.isThrottled()) return;
        this.batchedInteractions.push(objConfig);
        this.disableReenableInteractions();
        window.setTimeout(this.updateObjects.bind(this), 10);
    }

    disableReenableInteractions() {
        window.setTimeout(() => {
            this.isThrottled.set(true);
            window.setTimeout(() => this.isThrottled.set(false), 200);
        }, 10);
    }

    updateObjects() {
        if (!this.batchedInteractions.length) return;
        const objConfig =
            this.batchedInteractions[this.batchedInteractions.length - 1];
        const updatedObjects = this.createUpdatedLevelObjects(objConfig);
        if (this.isEveryObjectInactive(updatedObjects)) {
            this.incrementLevel(updatedObjects);
        } else {
            this.levelObjects.set(updatedObjects);
        }
        this.playInteractionAudio(objConfig.name);
        this.updateScore(objConfig);
        this.batchedInteractions = [];
    }

    incrementLevel(levelObjects: LevelObjectConfig[]) {
        const newLevelObjects = generateNewItems(numBalloons);
        if (levelObjects.length >= 20) {
            this.levelObjects.set(newLevelObjects);
        }
        this.levelObjects.set([...levelObjects, ...newLevelObjects]);
    }

    updateScore(event: ObjectUpdate) {
        this.score.update((currentScore: number) => {
            return Math.round(
                currentScore + event.basePoints / event.size.width,
            );
        });
    }

    createUpdatedLevelObjects(
        loConfig: Partial<AttrConfig>,
    ): LevelObjectConfig[] {
        return structuredClone(this.levelObjects()).reduce(
            (acc: LevelObjectConfig[], curr: LevelObjectConfig) => {
                if (curr.attrs.id === loConfig.id) {
                    curr.attrs.isActive = false;
                }
                return [...acc, curr];
            },
            [],
        );
    }

    incrementBgmSong(): void {
        if (this.bgmSongIndex() >= bgmArr.length - 1) {
            this.bgmSongIndex.set(0);
        } else {
            this.bgmSongIndex.update((i: number) => i + 1);
        }
    }
}
