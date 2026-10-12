import {Component} from '@angular/core';
import {bootstrapApplication} from '@angular/platform-browser';

@Component({
    selector: 'app-root',
    template: '<h1 i18n="@@greeting">Hello</h1><p i18n="@@new">New message</p>'
})
class AppComponent {}

bootstrapApplication(AppComponent);
