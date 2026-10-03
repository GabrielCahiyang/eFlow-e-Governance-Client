import {readFileSync,readdirSync} from 'node:fs';
import {join,relative} from 'node:path';
import ts from 'typescript';
import {describe,expect,it} from 'vitest';
const root=new URL('../../src/',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1');
function files(dir:string):string[]{return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(join(dir,entry.name)):[join(dir,entry.name)]);}
describe('active production terminology',()=>{
 it('keeps legacy vocabulary out of display copy while preserving database and employment identifiers',()=>{
  const violations:string[]=[];
  const retired=/role-(executive|legislative|hrmo|finance)|components[\\/](Executive|Legislative|HRMO|Finance|TeamLeader)[\\/]/;
  for(const path of files(root).filter(p=>/\.(ts|tsx)$/.test(p)&&!retired.test(p))){
   const text=readFileSync(path,'utf8'),source=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true);
   const visit=(node:ts.Node)=>{
    if(ts.isJsxText(node)||ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)||ts.isTemplateHead(node)||ts.isTemplateMiddle(node)||ts.isTemplateTail(node)){
     const raw=node.getText(source);
     const compatibilityToken=/^["'`](department|employee|departments|employees)["'`]$/.test(raw)||/[a-z]_[a-z]|employee_id/.test(raw)||ts.isImportDeclaration(node.parent)||ts.isExportDeclaration(node.parent);
     if(!compatibilityToken&&/\b(Super Admin|Department Head|Assistant Head|Departments?|Employees?)\b(?! ID| Number| No\.)/.test(raw))violations.push(relative(root,path)+':'+(source.getLineAndCharacterOfPosition(node.getStart()).line+1)+' '+raw.slice(0,130));
    }ts.forEachChild(node,visit);
   };visit(source);
  }
  expect(violations).toEqual([]);
 },15000);
});
