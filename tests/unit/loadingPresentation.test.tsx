// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import {LoadingScreen} from '../../src/app/features/app-shell/LoadingScreen';
import {ViewLoadingState} from '../../src/app/components/ui/ViewLoadingState';
afterEach(cleanup);
it('shows only the brand, heading and progress track during startup',()=>{
 const {container}=render(<LoadingScreen/>);expect(screen.getByRole('img',{name:'eFlow'})).toBeVisible();expect(screen.getByRole('heading',{name:'Getting things ready'})).toBeVisible();expect(screen.getByRole('status')).toHaveTextContent('Getting things ready');expect(container.querySelector('.eflow-loading-track')).toBeTruthy();expect(screen.queryByText('LGU Ormoc City')).toBeNull();expect(screen.queryByText('Loading eFlow…')).toBeNull();
});
it('gives deferred views an animated brand and a responsive skeleton',()=>{
 const {container}=render(<ViewLoadingState/>);expect(screen.getByRole('status',{name:'Getting your workspace ready'})).toBeVisible();expect(screen.getByRole('img',{name:'eFlow'})).toBeVisible();expect(container.querySelectorAll('.eflow-view-loading__cards>div')).toHaveLength(4);expect(screen.queryByText('Loading view…')).toBeNull();
});
