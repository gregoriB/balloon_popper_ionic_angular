import { APP_INITIALIZER, importProvidersFrom, isDevMode } from '@angular/core';
import { RouteReuseStrategy, provideRouter } from '@angular/router';
import { bootstrapApplication } from '@angular/platform-browser';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { provideServiceWorker } from '@angular/service-worker';
import { IonicStorageModule, Storage } from '@ionic/storage-angular';
import { AdService } from './app/services/ad.service';

bootstrapApplication(AppComponent, {
    providers: [
        { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
        importProvidersFrom(IonicModule.forRoot({})),
        provideRouter(routes),
        provideServiceWorker('ngsw-worker.js', {
            enabled: !isDevMode(),
            registrationStrategy: 'registerWhenStable:30000',
        }),
        provideServiceWorker('ngsw-worker.js', {
            enabled: !isDevMode(),
            registrationStrategy: 'registerWhenStable:30000',
        }),
        AdService,
        {
            provide: APP_INITIALIZER,
            useFactory: (as: AdService) => () => as.initializeAndPrepare(),
            deps: [AdService],
            multi: true,
        },
        Storage,
        IonicStorageModule,
    ],
});
