# Live function grant inventory

Read-only capture from `ixnfphgjyelhckjwjkdv`, 22 October 2026 Manila. This is the pre-deployment inventory, not a claim that every EXECUTE grant is a vulnerability. Trigger-only routines cannot be invoked as ordinary RPCs; authenticated definer endpoints intentionally implement scoped RLS-safe operations. See REVIEW.md for risk classification and proven gaps.

| Exact identity | Definer | anon EXECUTE | authenticated EXECUTE | Settings | Definition MD5 |
|---|---|---|---|---|---|
| `eflow_budget.assign_pcv()` | yes | no | no | search_path="" | `217c831ef36051ebfeb3dbe47192c3e9` |
| `eflow_budget.authorized_cash_lines(p_request uuid)` | yes | no | no | search_path="" | `5d042bf39ebcacf55402f4002e494ccf` |
| `eflow_budget.canonical_cash_lines(value jsonb)` | no | no | no | search_path="" | `767e3ee009f0e3a83f582f02a8dbd846` |
| `eflow_budget.cash_request_v2(p_task uuid, p_subtask uuid, p_lines jsonb, p_purpose text, p_needed_by date, p_key uuid, p_existing uuid)` | yes | no | yes | search_path="" | `915847fb283b18a0b5ac3513c2f26d69` |
| `eflow_budget.check_cash_line_total()` | yes | no | no | search_path="" | `ec354cd51a7a20dd84c892ae0abc917f` |
| `eflow_budget.check_itemized_liquidation()` | yes | no | no | search_path="" | `bb8a0615e8017853ce9ead03b686afc6` |
| `eflow_budget.check_partition_balances()` | yes | no | no | search_path="" | `da8694fab43d1b645f7aaf4150420e34` |
| `eflow_budget.check_section_total()` | yes | no | no | search_path="" | `006da1e1a7471145b19952f0a512e16d` |
| `eflow_budget.fund_work(p_task_id uuid, p_fiscal_year integer, p_lines jsonb, p_reason text, p_authorization_key uuid)` | yes | no | yes | search_path="" | `d4402e4eacbfa75c82c3dbd656be2166` |
| `eflow_budget.get_sections(p_org_id uuid, p_fiscal_year integer)` | yes | no | yes | search_path="" | `6c76d3522f909c94b3544734f37bcc11` |
| `eflow_budget.guard_cash_correction()` | yes | no | no | search_path="" | `8dc4fe1c87d9d3382ec9572e1ce5dbc3` |
| `eflow_budget.guard_cash_line_identity()` | no | no | no | search_path="" | `19d387c970d32c2b2c153f76c5786cc2` |
| `eflow_budget.guard_itemized_liquidation()` | yes | no | no | search_path="" | `14198cb15166cb3246448922a19027b4` |
| `eflow_budget.guard_partition_funding()` | yes | no | no | search_path="" | `be8f4b0b006160fc3f5524535273cf6b` |
| `eflow_budget.guard_receipt_item_insert()` | yes | no | no | search_path="" | `b76d73dc76c62539623eabae000667da` |
| `eflow_budget.integrity_liquidation_retry(p_request_id uuid, p_declared_spent numeric, p_note text, p_receipts jsonb, p_idempotency_key uuid)` | yes | no | no | search_path="" | `0b54bf9af9fd6baf3f6814a164bf3ba3` |
| `eflow_budget.integrity_receipts(p_receipts jsonb)` | no | no | no | search_path="" | `1e132a0c5f2a2ea2fc36bfa302bbed60` |
| `eflow_budget.legacy_resubmit_cash(p_request_id uuid, p_allocation_line_id uuid, p_amount numeric, p_purpose text, p_needed_by date)` | yes | no | no | search_path="" | `7bd9fdb289898e4d2dd96b5bb52086ba` |
| `eflow_budget.legacy_summary(p_org_id uuid, p_fiscal_year integer)` | yes | no | no | search_path=public | `3f855266d5e42c074f3c9f154bfed45a` |
| `eflow_budget.legacy_task_context(p_task_id uuid, p_subtask_id uuid)` | yes | no | no | search_path=public | `afe12ce4c59ac50ebfa37a7c23855d8c` |
| `eflow_budget.map_account(p_section uuid, p_code text)` | yes | no | yes | search_path="" | `aba46877309b71bcf7c7a78e76c96c3f` |
| `eflow_budget.partition_committed(p_section uuid)` | no | no | no | search_path="" | `0ab5b49a2eb9834fff85006bb7d7516f` |
| `eflow_budget.partition_spent(p_section uuid)` | no | no | no | search_path="" | `234f5eef54a6a5b8e36b4a6a4e1e17aa` |
| `eflow_budget.pre_financial_get_sections(p_org_id uuid, p_fiscal_year integer)` | yes | no | no | search_path="" | `9dff8459db93d01d7427213619e3ae66` |
| `eflow_budget.pre_financial_task_context(p_task_id uuid, p_subtask_id uuid)` | yes | no | no | search_path="" | `7ccf65b916ef145c580172f2266c9775` |
| `eflow_budget.pre_integrity_accounting_liquidation(p_request_id uuid, p_declared_spent numeric, p_note text, p_receipts jsonb, p_idempotency_key uuid, p_refund_receipt_number text, p_refund_date date)` | yes | no | no | search_path=public | `78fa5bce9e9f9720e1a1590f6470820b` |
| `eflow_budget.pre_integrity_contextual_liquidation(p_request_id uuid, p_declared_spent numeric, p_note text, p_receipts jsonb, p_idempotency_key uuid)` | yes | no | no | search_path=public | `facb87e191b134f874f9c1b529f4e03a` |
| `eflow_budget.pre_integrity_journal(p_fiscal_budget_id uuid, p_entry_date date, p_reference_number text, p_memo text, p_lines jsonb)` | yes | no | no | search_path=public | `7e8f49a1b48532d361d2c6bf0d8a2f9c` |
| `eflow_budget.request_line_obligation(p_request uuid, p_line uuid)` | no | no | no | search_path="" | `14df49a2cf9f3ce4165b579647507968` |
| `eflow_budget.save_sections(p_org_id uuid, p_fiscal_year integer, p_sections jsonb, p_expected_version integer, p_reason text, p_settings jsonb)` | yes | no | yes | search_path="" | `7b5866662ffdf062834ee4181051528f` |
| `eflow_budget.section_total(p_budget_id uuid, p_held boolean)` | no | no | no | search_path="" | `56f9d2a9b1994e7aba1f1b4bcec6d87e` |
| `eflow_budget.submit_items(p_request uuid, p_spent numeric, p_note text, p_receipts jsonb, p_key uuid, p_refund_number text, p_refund_date date)` | yes | no | yes | search_path="" | `dce28ee2cfde63062fa9cd0e91e8829a` |
| `eflow_budget.summary(p_org_id uuid, p_fiscal_year integer)` | yes | no | yes | search_path="" | `89ab3db1ed57ddc9bfc4aff7ba3be4bd` |
| `eflow_budget.sync_single_cash_line()` | yes | no | no | search_path="" | `46e9449f299914717b89fa773c953c69` |
| `eflow_budget.task_context(p_task_id uuid, p_subtask_id uuid)` | yes | no | yes | search_path="" | `fb06f2cea3a797e33ae9674b9fdbd301` |
| `eflow_budget.valid_money(value numeric, allow_zero boolean)` | no | no | no | search_path="" | `372b6b4eac1562eb9177d7ae1dc229dc` |
| `public._lt_q_regex(ltree[], lquery[])` | no | yes | yes | session default | `44af432ff91b38ba1875ead9c3df93ca` |
| `public._lt_q_rregex(lquery[], ltree[])` | no | yes | yes | session default | `9f406a4fd025b1ce0ceac765239c0253` |
| `public._ltq_extract_regex(ltree[], lquery)` | no | yes | yes | session default | `6deb6f4d53e7360768894bce983676a8` |
| `public._ltq_regex(ltree[], lquery)` | no | yes | yes | session default | `a7a6e5afd70849a4693e1a7670e112b7` |
| `public._ltq_rregex(lquery, ltree[])` | no | yes | yes | session default | `ca9af0035b1099ac126dc2f60aa1f3bb` |
| `public._ltree_compress(internal)` | no | yes | yes | session default | `6dc64a251b0a2abca2ebfed37b03b709` |
| `public._ltree_consistent(internal, ltree[], smallint, oid, internal)` | no | yes | yes | session default | `f832a3ed4852d35de6579e61f7ae05dc` |
| `public._ltree_extract_isparent(ltree[], ltree)` | no | yes | yes | session default | `96c20dd27edcb27343365375e9abfc55` |
| `public._ltree_extract_risparent(ltree[], ltree)` | no | yes | yes | session default | `0326371ceda09b0e0975ed729705acd1` |
| `public._ltree_gist_options(internal)` | no | yes | yes | session default | `048c0c15fd98e6c0247e83264452e644` |
| `public._ltree_isparent(ltree[], ltree)` | no | yes | yes | session default | `5f800cefdc6af3d470c994c51e61681b` |
| `public._ltree_penalty(internal, internal, internal)` | no | yes | yes | session default | `6c9bea5ce9e186051d60362d5e9f84fb` |
| `public._ltree_picksplit(internal, internal)` | no | yes | yes | session default | `8acf330b4b881e7ca4e9b6cbe1d5252a` |
| `public._ltree_r_isparent(ltree, ltree[])` | no | yes | yes | session default | `8aa0f43aab03e10ac5682eb141d8b4f7` |
| `public._ltree_r_risparent(ltree, ltree[])` | no | yes | yes | session default | `8206e19f300df077f41188831c1f6c2b` |
| `public._ltree_risparent(ltree[], ltree)` | no | yes | yes | session default | `f887751d2cf7b54e75b0ce38d0bc6c1c` |
| `public._ltree_same(ltree_gist, ltree_gist, internal)` | no | yes | yes | session default | `0354ee17ac7448369db7424b61d58aa0` |
| `public._ltree_union(internal, internal)` | no | yes | yes | session default | `76f008717eb8b91d2ae63379dd0d69a5` |
| `public._ltxtq_exec(ltree[], ltxtquery)` | no | yes | yes | session default | `fb8d88406fc7dc603e4efc6a92d7f460` |
| `public._ltxtq_extract_exec(ltree[], ltxtquery)` | no | yes | yes | session default | `74a9bd0d1fd3537bb5234d323e086d86` |
| `public._ltxtq_rexec(ltxtquery, ltree[])` | no | yes | yes | session default | `75fa48d7458a0b8ee52361b7b6a7fbab` |
| `public.acknowledge_accounting_release(p_release_id uuid, p_voucher_number text)` | yes | no | yes | search_path=public | `5a4d5f7ab9d87969603166495dd80afc` |
| `public.acknowledge_petty_cash_release(p_release_id uuid)` | yes | yes | yes | search_path=public | `244481c9dc888eef8f75e0004f1ba5bf` |
| `public.add_cash_request_attachment(p_request_id uuid, p_file_name text, p_file_path text, p_mime_type text, p_file_size bigint)` | yes | no | yes | search_path=public | `9c358ca17fb44b3b8ebb12abd5420db1` |
| `public.adjust_department_fiscal_budget(p_budget_id uuid, p_adjusted_amount numeric, p_reason text, p_support_file_path text)` | yes | yes | yes | search_path=public | `6a76244e68d6e015d17d0f713272bb8f` |
| `public.apply_subtask_template(p_template_id uuid, p_task_id uuid, p_mode text, p_items jsonb)` | yes | no | yes | search_path=public | `0a1803cd3fbf82d95a912cdb43c16dfe` |
| `public.archive_completed_project(p_project_id uuid, p_reason text)` | yes | no | yes | search_path=public | `85c97bafa7bbd3cafb057c585e7fd1ec` |
| `public.archive_proposal_delivery(p_draft_id uuid, p_reason text)` | yes | no | yes | search_path=public | `d62c14384e96d83d3961c2ccd4d9de3c` |
| `public.assign_accounting_document_number()` | yes | yes | yes | search_path=public | `4546d4f6e73006ed4541c5f2591cef72` |
| `public.assign_task(p_task_id uuid, p_assignee uuid, p_assignee_name text)` | yes | yes | yes | search_path=public | `071df7b5b01d74d9388fa3bdd4a6d0c6` |
| `public.assign_task_with_details(p_task_id uuid, p_assignee uuid, p_assignee_name text, p_team_id text, p_team_name text, p_team_member_ids jsonb, p_team_member_names jsonb, p_reviewer uuid, p_backup_reviewer uuid, p_set_reviewers boolean)` | yes | no | yes | search_path=public | `e7a5e87a842c8ca6dfc32524bf655578` |
| `public.audit_access_control_change()` | yes | yes | yes | search_path=public | `953d51361053eb0be8b69063810f93cc` |
| `public.audit_cash_release_change()` | yes | yes | yes | search_path=public | `5a82f6aa1e3e5f2ee72aac39f1532d82` |
| `public.audit_cash_request_change()` | yes | no | no | search_path="" | `531a41f26470d6fc2fe0359ceb7b1d30` |
| `public.audit_liquidation_change()` | yes | yes | yes | search_path=public | `0fcb8ea87f7aec058490ff916d8ea417` |
| `public.audit_receipt_attachment()` | yes | yes | yes | search_path=public | `385adacee7914293d90d8dad1cd9977d` |
| `public.auth_org_path(caller_id uuid)` | yes | yes | yes | search_path=public | `9827e68494b4311d28c6d91e04b7a5b6` |
| `public.auth_role(caller_id uuid)` | yes | yes | yes | search_path=public | `0acb02fabea04da04939e7e1b207e24c` |
| `public.auto_accept_collaboration_owner()` | yes | no | yes | search_path=public | `f61ef622b08cd54a05f154e5bf8851cf` |
| `public.auto_assign_project_task(p_root uuid, p_revision integer, p_request uuid, p_lead uuid, p_people uuid[])` | yes | no | yes | search_path="" | `d0df86132313ddb2f0e0c15280b876d9` |
| `public.autosave_collaboration_draft(p_draft_id uuid, p_title text, p_snapshot jsonb)` | yes | no | yes | search_path=public | `227613fe93a1b48b19eb59aacc2567f0` |
| `public.can_access_org(p_user_id uuid, p_org_id uuid, p_access_level text)` | yes | yes | yes | search_path=public | `8b635757f7313199004409863274ce8f` |
| `public.can_approve_work_templates(target_org uuid, caller_id uuid)` | yes | no | yes | search_path=public | `089a165f4e1ee4ff7f148b69b7df903f` |
| `public.can_contribute_task(target_task uuid, caller_id uuid)` | yes | yes | yes | search_path="" | `ca098315280c2638f36d6be5ba8a0036` |
| `public.can_create_scoped_work(target_org uuid, caller_id uuid)` | yes | yes | yes | search_path=public | `2b3357e7b3be81d8218d1bbe39ad08b2` |
| `public.can_manage_collaboration_draft(target_draft uuid, caller_id uuid)` | yes | no | yes | search_path=public | `5d8900067721320f26580c587e842ead` |
| `public.can_manage_collaboration_project(target_project uuid, caller_id uuid)` | yes | no | yes | search_path=public | `c7a894535a9c7073d728e642079d65b4` |
| `public.can_manage_department_accounting(target_org uuid, caller_id uuid)` | yes | yes | yes | search_path=public | `a113375ff554703323bed38f8df2ec86` |
| `public.can_manage_project(target_project uuid, caller_id uuid)` | yes | yes | yes | search_path=public | `c535113a5d3e0b7cddcc5836cec978ee` |
| `public.can_manage_proposal_delivery(target_draft uuid, caller_id uuid)` | yes | no | yes | search_path=public | `33d7211047fb4d0584d3b95130ccd1d3` |
| `public.can_manage_subtasks(target_task uuid, caller_id uuid)` | yes | yes | yes | search_path=public | `be24c83555b09b816fa0d4ff7c560085` |
| `public.can_manage_task(target_task uuid, caller_id uuid)` | yes | yes | yes | search_path="" | `7acd1123023774cb4c9c88285f0295b7` |
| `public.can_see_collaboration_project(target_project uuid, caller_id uuid)` | yes | no | yes | search_path=public | `57f93cd7ebe1525ab85f61c76261e1ac` |
| `public.can_see_project(target_project uuid, caller_id uuid)` | yes | yes | yes | search_path="" | `0effec1afad5955336e9e292d8e597de` |
| `public.can_see_task(target_task uuid, caller_id uuid)` | yes | yes | yes | search_path="" | `5a8bd82a0f3dabff6aa496946fba7936` |
| `public.can_use_work_templates(target_org uuid, caller_id uuid)` | yes | no | yes | search_path=public | `547d6402723ce48b6840118c6102459e` |
| `public.can_view_department_budget(target_org uuid, caller_id uuid)` | yes | no | yes | search_path=public | `c153cf285e74b568237d0bc6dd56d085` |
| `public.cancel_contextual_cash_request(p_request_id uuid, p_reason text)` | yes | no | yes | search_path=public | `167fa99e9f95f94d5493024d4954a047` |
| `public.cancel_task(p_task_id uuid, p_reason text)` | yes | no | yes | search_path=public | `48f4a2f677a9c524f233c3dd51a6e22c` |
| `public.cash_request_obligation(request_row petty_cash_requests)` | no | no | yes | search_path=public | `3164945cb921e9859aef9fd88b56091d` |
| `public.claim_task_evidence_cleanup(p_object_name text, p_bucket_id text)` | yes | no | yes | search_path=pg_catalog | `86d8e60820ec4e5a120d4c4500bed36d` |
| `public.clear_test_operational_data()` | yes | no | yes | search_path=public | `40e222e0506d2007c5a7f663a3882717` |
| `public.close_department_fiscal_budget(p_budget_id uuid, p_reason text)` | yes | yes | yes | search_path=public | `23abc03aee5b37ab3baf220e131eff87` |
| `public.collaboration_readiness(target_draft uuid)` | yes | no | yes | search_path=public | `c3964c6194a83ebac472f71e668b4a7a` |
| `public.collaboration_revision_is_material(p_previous jsonb, p_next jsonb)` | no | no | yes | search_path=public | `5baf460d11a00bc3ce3ace316d992fd2` |
| `public.collaboration_storage_draft_id(object_name text)` | no | yes | yes | session default | `fcde1a33c7ec3d9d8c2d9a9a06b07159` |
| `public.commit_collaboration_draft(p_draft_id uuid, p_revision_id uuid)` | yes | no | yes | search_path=public | `2bb781b92adb46d2201233b84377997d` |
| `public.commit_single_department_proposal_budget()` | yes | yes | yes | search_path=public | `8b33f065ddbbf95fd1eaa6cf3780f3d0` |
| `public.complete_pdf_import_session(p_id uuid, p_revision integer, p_runner uuid)` | yes | no | yes | search_path="" | `3f0432d9b04efae9a56f458863d7266f` |
| `public.complete_project(p_project_id uuid, p_note text)` | yes | no | yes | search_path=public | `9ffe136f42ea2d430aebbc1afb8509ea` |
| `public.complete_proposal_delivery(p_draft_id uuid, p_note text)` | yes | no | yes | search_path=public | `fc04e645343281b422dbd889ae5b6e3f` |
| `public.create_collaboration_change_request(p_draft_id uuid, p_target_type text, p_target_key text, p_reason text, p_proposed_change jsonb, p_organization_id uuid)` | yes | no | yes | search_path=public | `68844d74b5933db6e286fddcd8d87f9c` |
| `public.create_collaboration_draft(p_title text, p_owner_org_id uuid, p_source_type text, p_source_file_name text, p_source_file_path text, p_source_file_hash text, p_snapshot jsonb)` | yes | no | yes | search_path=public | `90635b97f9a7b589c2015a770a8ce467` |
| `public.create_contextual_cash_request(p_task_id uuid, p_subtask_id uuid, p_allocation_line_id uuid, p_amount numeric, p_purpose text, p_needed_by date, p_idempotency_key uuid)` | yes | no | yes | search_path="" | `106043825490656ae525ad1890b7984a` |
| `public.create_contextual_cash_request_v2(p_task uuid, p_subtask uuid, p_lines jsonb, p_purpose text, p_needed_by date, p_key uuid, p_existing uuid)` | no | no | yes | search_path="" | `ba313a0eb3e72180dba690f5d2b34b2c` |
| `public.create_default_department_accounting_settings()` | yes | yes | yes | search_path=public | `02064743d5eb10bc6d3edbde1d1b1b0a` |
| `public.create_default_user_preferences()` | yes | yes | yes | search_path=public | `2e0304b9043e85cc54e8f34dc13c9ceb` |
| `public.create_org_chat_channel()` | no | yes | yes | session default | `e678d31b6e01e27dd2946a617871af93` |
| `public.create_petty_cash_request(p_allocation_id uuid, p_amount numeric, p_purpose text, p_needed_by date)` | yes | yes | yes | search_path=public | `6d5876afa2fcb1127b62e7e722ed0e03` |
| `public.create_petty_cash_request(p_allocation_id uuid, p_amount numeric, p_purpose text, p_needed_by date, p_subtask_id uuid)` | yes | yes | yes | search_path=public | `83114f6d65a5b86c3233519fae0afee0` |
| `public.create_project_with_details(p_payload jsonb)` | yes | yes | yes | search_path=public | `11b6b83b80b9fab1a2d91bfad15f3edb` |
| `public.create_subtask_budget_allocation(p_task_id uuid, p_subtask_id uuid, p_parent_allocation_line_id uuid, p_amount numeric, p_reason text)` | yes | yes | yes | search_path=public | `52fea8450afcf76e0333ae76cb4b7813` |
| `public.create_task_with_details(p_payload jsonb)` | yes | yes | yes | search_path=public | `151a8c3a4b01cb04b02bbc5aa8c06e2f` |
| `public.create_work_budget_allocation(p_task_id uuid, p_subtask_id uuid, p_amount numeric, p_reason text)` | yes | yes | yes | search_path=public | `47f72357fe30242cc410e88f4ff9d161` |
| `public.decide_collaboration_review(p_draft_id uuid, p_organization_id uuid, p_decision text, p_reason text)` | yes | no | yes | search_path=public | `4903d4c6af6ab0ab0ecaa67ddac7b8c0` |
| `public.decide_petty_cash_leader_review(p_request_id uuid, p_approve boolean, p_reason text)` | yes | yes | yes | search_path=public | `704f7d77f0ec2da6a2d0857360366681` |
| `public.decide_petty_cash_liquidation(p_liquidation_id uuid, p_approve boolean, p_reason text)` | yes | yes | yes | search_path=public | `7c2852043c5093f8775972ac66dc7e99` |
| `public.decide_petty_cash_liquidation_leader_review(p_liquidation_id uuid, p_approve boolean, p_reason text)` | yes | yes | yes | search_path=public | `7ad8f2ee8e0c951a583de8fda0e09a39` |
| `public.decide_petty_cash_request(p_request_id uuid, p_approve boolean, p_reason text)` | yes | yes | yes | search_path=public | `fc55cfd74a2d7090cdd3b743fba8bd77` |
| `public.decide_proposal_closeout(p_draft_id uuid, p_organization_id uuid, p_decision text, p_reason text, p_resolution_number text, p_meeting_date date)` | yes | no | yes | search_path=public | `a5d35fb4bd7e0358a942512a8ea515d8` |
| `public.decide_subtask_review(p_subtask_id uuid, p_approve boolean, p_feedback text)` | yes | no | yes | search_path=public | `a6229126e5157a951db19a6489de0e9b` |
| `public.decide_task_review(p_task_id uuid, p_approve boolean, p_feedback text, p_audit_hash text)` | yes | no | yes | search_path=public | `4db7554606c65b1c8e03423dcf06c339` |
| `public.decide_work_budget_allocation(p_allocation_id uuid, p_approve boolean, p_reason text)` | yes | yes | yes | search_path=public | `be330eeee72ccbc8ec7622daa7240e82` |
| `public.delete_empty_project_group(p_group_id uuid)` | yes | no | yes | search_path="" | `8cf57fb1d063ee090a973c1b624d4f24` |
| `public.delete_project_group(p_group_id uuid)` | yes | no | yes | search_path="" | `42d0131d1c5be61a0f1ffd429f1252ea` |
| `public.delete_project_permanently(p_project_id uuid, p_expected_title text, p_reason text)` | yes | no | yes | search_path="" | `25ebb25f71fbc3e70c2bf85794d91fa0` |
| `public.delete_subtask_budget_allocation(p_allocation_id uuid)` | yes | yes | yes | search_path=public | `492c9142891b1853982f4b50db3a9cce` |
| `public.department_budget_summary(p_org_id uuid, p_fiscal_year integer)` | no | yes | yes | search_path="" | `f783ee905526dabfbca7d381540aa21b` |
| `public.dispatch_hierarchy_deadline_reminders()` | yes | no | yes | search_path=public | `8e0b62ac327e1c796ceef37480910fe0` |
| `public.dispatch_task_reminders()` | yes | no | yes | search_path=public | `54755eadeaf7c1692a7ef570bf668210` |
| `public.dispatch_task_review_reminders()` | yes | no | yes | search_path=public | `3f2ca3674757ddc7723a6773ce8c3af3` |
| `public.eflow_claim_managed_activation(p_hash text, p_claim uuid)` | yes | no | no | search_path="" | `d5ea2a13c54e1af4950f9f0a9e45fdc3` |
| `public.eflow_complete_managed_activation(p_hash text, p_claim uuid, p_auth_user uuid)` | yes | no | no | search_path="" | `ca0bc632f9a20c3155ac36f07f9ad2fa` |
| `public.eflow_create_managed_activation(p_actor uuid, p_data jsonb, p_hash text, p_ttl integer)` | yes | no | no | search_path="" | `358af6429f0de9c9c99858b81bd90903` |
| `public.eflow_list_managed_activations(p_actor uuid)` | yes | no | no | search_path="" | `181a5f4e7b83e13a0d19803900c55c44` |
| `public.eflow_login_admin(p_actor uuid, p_action text, p_user uuid, p_limit integer, p_lease uuid)` | no | no | no | search_path="" | `4121a2ae1921449f07c3925572b8c607` |
| `public.eflow_login_begin(p_email text)` | no | no | no | search_path="" | `7d2e994c02445c876547e2983255690f` |
| `public.eflow_login_finish(p_user uuid, p_lease uuid, p_outcome text, p_ban_until timestamp with time zone)` | no | no | no | search_path="" | `79a1908adf6cc2a5fd54152c67dc3746` |
| `public.eflow_login_gateway_endpoint()` | yes | yes | yes | search_path="" | `809ad245cffba75d636bd89a060e5b9b` |
| `public.eflow_manage_managed_activation(p_actor uuid, p_id uuid, p_action text, p_hash text, p_ttl integer)` | yes | no | no | search_path="" | `6d0a362a9b934d2049a022e0307c408a` |
| `public.eflow_managed_account_options(p_actor uuid)` | yes | no | no | search_path="" | `ead66d59a0b41906bc7c18eb3b9e1690` |
| `public.eflow_managed_activation_delivery(p_id uuid, p_hash text, p_status text, p_message text)` | yes | no | no | search_path="" | `a65c9ef589513eb4816af4d223622414` |
| `public.eflow_managed_activation_limit(p_key text, p_max integer)` | yes | no | no | search_path="" | `51324fe8203ab0f87d576c3df249dcb7` |
| `public.eflow_reconcile_managed_activation(p_id uuid, p_claim uuid, p_auth_user uuid)` | yes | no | no | search_path="" | `048c9f68273050e7d2c6ee66a33e575d` |
| `public.eflow_reserve_managed_activation_email(p_id uuid, p_hash text)` | yes | no | no | search_path="" | `2ab9d3d00b9ff9a8ad52028679b56994` |
| `public.eflow_validate_managed_activation(p_hash text)` | yes | no | no | search_path="" | `9e1942c3683a64958637a62c019b1845` |
| `public.ensure_org_chat_channel()` | yes | no | no | session default | `0d026af85608da516ee6f0e3b9e6ba5b` |
| `public.fund_office_work(p_task_id uuid, p_fiscal_year integer, p_lines jsonb, p_reason text, p_authorization_key uuid)` | no | no | yes | search_path="" | `2e0e183dfb9962bde4284da048ba51b8` |
| `public.get_office_budget_sections(p_org_id uuid, p_fiscal_year integer)` | no | no | yes | search_path="" | `7cfbb52edb1751a479bb35ce3aa82a69` |
| `public.get_project_completion_readiness(p_project_id uuid)` | yes | no | yes | search_path=public | `2308519e7a03e942c64ce226fd08f317` |
| `public.get_task_evidence_rules()` | no | no | yes | search_path=pg_catalog | `d5caca15497e3b3a269fc5592c2a493d` |
| `public.get_task_funding_context(p_task_id uuid, p_subtask_id uuid)` | no | no | yes | search_path="" | `11469f89c8f65aa52bcef3cb69ecc1c5` |
| `public.guard_active_subtask_team_member_removal()` | yes | no | no | search_path=public | `08b8e8cb3ae8a96f77641095f7b08c86` |
| `public.guard_admin_permission_overrides()` | yes | yes | yes | search_path=public | `75b429b198c88c248e7cecb22695cbd0` |
| `public.guard_admin_role_permissions()` | yes | yes | yes | search_path=public | `bd2f8e6744b39c712393dce46877da44` |
| `public.guard_administrative_leadership_assignment()` | no | yes | yes | search_path=public | `1716a78d9502f3b40b3737b7e5628a9c` |
| `public.guard_administrative_role_management()` | no | yes | yes | search_path=public | `4ff3b6d5c92f4a05618796c36d84c332` |
| `public.guard_collaboration_owner_decision()` | yes | no | yes | search_path=public | `79cbbdf2b079aa4cd8362527f1b977d9` |
| `public.guard_collaboration_task_staffing()` | yes | yes | yes | search_path=public | `c3298986b5ae9c459024d663baa1e1e4` |
| `public.guard_financial_work_completion()` | yes | yes | yes | search_path=public | `d71047fe75140ae07f6533bc71d8d0da` |
| `public.guard_last_active_admin()` | yes | yes | yes | search_path=public | `56207e10af1f69a7a8facb0d4d91f537` |
| `public.guard_late_liquidation_head_approval()` | yes | no | no | search_path=public | `dd12cdfacbc88989bfbfad3822502b7b` |
| `public.guard_liquidation_release_acknowledgement()` | yes | yes | yes | search_path=public | `2be1a837b489767464c7e34aa08c416b` |
| `public.guard_organization_leadership_membership()` | yes | no | no | search_path=public | `a03580eb1ce264b45fff5656cab4e740` |
| `public.guard_petty_cash_allocation_capacity()` | yes | yes | yes | search_path=public | `3cfab6e27bb2792a614240045a4a2665` |
| `public.guard_profile_leadership_integrity()` | no | yes | yes | search_path=public | `91823410fbbba29e6eac81dbe5719c9d` |
| `public.guard_project_completion_lifecycle()` | yes | no | no | search_path=public | `683d90d5ce63b942c7fb1acb09619876` |
| `public.guard_project_metadata_edit()` | no | no | no | search_path="" | `1d680ad9109803f613dc339489697c77` |
| `public.guard_recurring_template_scope()` | yes | no | no | search_path=public | `95238899661148167342eb55a2979c36` |
| `public.guard_self_profile_update()` | no | yes | yes | search_path=public | `34fa799510862e53ae9905bd68e47256` |
| `public.guard_single_department_collaboration_review()` | no | no | no | search_path=public | `000a80822570ae270dce1244467dbd0c` |
| `public.guard_subtask_contributor_update()` | yes | yes | yes | search_path=public | `72fd304e6eecd1f668dac224f53b48ed` |
| `public.guard_subtask_due_date_bounds()` | yes | yes | yes | search_path=public | `ec493b5458b081d1ce3e5089eb5c1f3e` |
| `public.guard_subtask_due_date_update()` | yes | yes | yes | search_path=public | `b303f29693ab91638e1c0210be021669` |
| `public.guard_subtask_execution_dependencies()` | yes | no | no | search_path=public | `49c2e9ed7ce474df1619581b43818d1f` |
| `public.guard_subtask_mutation()` | yes | no | no | search_path=public | `d59366c3485b00244f19e77d6f7046dc` |
| `public.guard_subtask_template_governance()` | yes | no | no | search_path=public | `d841c01da70693df50e12d3cb10b74fc` |
| `public.guard_super_admin_project_mutation()` | no | yes | yes | search_path=public | `3ab44d49b90f3fdf94b9ee73adfcde65` |
| `public.guard_super_admin_task_mutation()` | no | yes | yes | search_path=public | `7e43fab7fe881377dfb40d370be0587a` |
| `public.guard_task_dependency_completion()` | yes | no | no | search_path=pg_catalog, public | `fb4450c93376d614214c698ed78ecd9c` |
| `public.guard_task_financial_completion()` | yes | yes | yes | search_path=public | `ce46c0fa39d78f902e577d119bf2de4a` |
| `public.guard_task_project_links()` | no | yes | yes | search_path=public | `8e898154bacc5b211468c794ee17c0c7` |
| `public.guard_task_review_decision()` | no | yes | yes | search_path=public | `770f13aa8c414845e0646da63b42709b` |
| `public.guard_task_status_write()` | no | yes | yes | search_path=public | `2a92e9971e8d78be6229beea022fa23d` |
| `public.guard_task_submission_readiness()` | no | yes | yes | search_path=public | `2034f657c260f7cf8266c48c1855646d` |
| `public.guard_task_subtask_readiness()` | no | yes | yes | search_path=public | `d057b07c831db238c2251beada3542ee` |
| `public.guard_work_budget_allocation_caps()` | yes | yes | yes | search_path=public | `1cac0d4e44db55896e995a7afdaeffd9` |
| `public.has_permission(p_user_id uuid, p_permission text)` | yes | yes | yes | search_path=public | `9658210810380e367c6a7e28fa2f5bf1` |
| `public.hash_ltree(ltree)` | no | yes | yes | session default | `4d1d972a645eb8063e5c9c8b9695aa99` |
| `public.hash_ltree_extended(ltree, bigint)` | no | yes | yes | session default | `d9ee2fc0fc2c552d5c461ebd5c53b2fc` |
| `public.import_project_pdf_work(p_project_id uuid, p_request_id uuid, p_review jsonb)` | no | no | yes | search_path="" | `e5191196220deeb9243fa94b0bee3e15` |
| `public.index(ltree, ltree)` | no | yes | yes | session default | `b2b48c7f47fd9ab56143e124c6600ea0` |
| `public.index(ltree, ltree, integer)` | no | yes | yes | session default | `82318248cdf386018a1a80c9df5a5cd8` |
| `public.inherit_collaboration_activity_responsibility()` | no | yes | yes | search_path=public | `85661a6a7e0e617af167fb3c6fba685b` |
| `public.invite_project_office_person(p_id uuid, p_identity uuid, p_email text, p_role text)` | yes | no | yes | search_path="" | `4db717033b0884077a2f8c5123520cc3` |
| `public.is_admin(caller_id uuid)` | yes | yes | yes | search_path=public | `f691d404b96b2885fd3ffa5c40a8c58d` |
| `public.is_allowed_task_transition(from_status text, to_status text)` | no | yes | yes | search_path=public | `bdd10b128124e9f4c354ff8c55158fdd` |
| `public.is_channel_member(p_channel uuid, caller uuid)` | yes | yes | yes | session default | `b634c4a111a1ce8510e589c0498cd96f` |
| `public.is_collaboration_participant(target_draft uuid, caller_id uuid)` | yes | no | yes | search_path=public | `17576c298ad8ea4b56d0e99b6b8f51a8` |
| `public.is_department_accounting_staff(target_org uuid, caller_id uuid)` | yes | yes | yes | search_path=public | `5a16292bc21890f39456fa8d04913a8e` |
| `public.is_department_budget_approver(target_org uuid, caller_id uuid)` | yes | yes | yes | search_path=public | `67614341ce7f9856541ecdde42930274` |
| `public.is_department_budget_head(target_org uuid, caller_id uuid)` | yes | yes | yes | search_path=public | `59d0ae3e7d2ff99719173cec3f75f49d` |
| `public.is_office_output_reviewer(target_org uuid, caller_id uuid)` | yes | yes | yes | search_path=public | `920191bf705efba9f52208fa0c0d11ec` |
| `public.is_organization_approver(target_organization uuid, caller_id uuid)` | yes | no | yes | search_path=public | `79747c864c085c6ccf11385234b2ccae` |
| `public.is_organization_member(target_organization uuid, caller_id uuid)` | yes | no | yes | search_path=public | `79d812c980622e81a52ba6e1e454d523` |
| `public.is_project_member(target_project uuid, caller_id uuid)` | yes | yes | yes | search_path=public | `bf021e13848680595b826764d0d52c40` |
| `public.is_proposal_governance_decider(target_draft uuid, target_org uuid, caller_id uuid)` | yes | no | yes | search_path=public | `eb8d590defea5a2e9e211117ca0a3f84` |
| `public.is_super_admin(caller_id uuid)` | yes | yes | yes | search_path=public | `63d426ca113ee3b0cd2775d24c94ef26` |
| `public.lca(ltree, ltree)` | no | yes | yes | session default | `4db42d9566b6ff6c651c39ff7bad7931` |
| `public.lca(ltree, ltree, ltree)` | no | yes | yes | session default | `4c832c632e912228090a2f5906077166` |
| `public.lca(ltree, ltree, ltree, ltree)` | no | yes | yes | session default | `c82c140615bcd3d2460eeca444e287d2` |
| `public.lca(ltree, ltree, ltree, ltree, ltree)` | no | yes | yes | session default | `fe6aa94d6c6b6de0710ed2f7ad77a5de` |
| `public.lca(ltree, ltree, ltree, ltree, ltree, ltree)` | no | yes | yes | session default | `05cb63441b7d0e764152ae8c5a5bca37` |
| `public.lca(ltree, ltree, ltree, ltree, ltree, ltree, ltree)` | no | yes | yes | session default | `5699d9af47b3f58204d8911a98bde24d` |
| `public.lca(ltree, ltree, ltree, ltree, ltree, ltree, ltree, ltree)` | no | yes | yes | session default | `55ea6a7fe6e78acb91b9aa8a53762090` |
| `public.lca(ltree[])` | no | yes | yes | session default | `63e455b2c16dda9d3d61212083677faa` |
| `public.lock_department_fiscal_budget(p_budget_id uuid)` | yes | yes | yes | search_path=public | `eacbcf8e7974afe8086fe1dfaa43506d` |
| `public.lquery_in(cstring)` | no | yes | yes | session default | `0fa607ab5ca27a738016c8412bd09ecf` |
| `public.lquery_out(lquery)` | no | yes | yes | session default | `db533fe3e728f2350f997ca876ee5d55` |
| `public.lquery_recv(internal)` | no | yes | yes | session default | `d541ca0a02e63b20480ba2d9d564dee5` |
| `public.lquery_send(lquery)` | no | yes | yes | session default | `3979f86b9329b6e9b339c36df671abde` |
| `public.lt_q_regex(ltree, lquery[])` | no | yes | yes | session default | `dda4a1c1cfcd2266f5d6481227de0c95` |
| `public.lt_q_rregex(lquery[], ltree)` | no | yes | yes | session default | `8918942ad45777a1fc2acec68f78a630` |
| `public.ltq_regex(ltree, lquery)` | no | yes | yes | session default | `40fd42caf3a2c6488bde158c2f35db8c` |
| `public.ltq_rregex(lquery, ltree)` | no | yes | yes | session default | `1a8a67afface8b4895b79f8db36d07c7` |
| `public.ltree2text(ltree)` | no | yes | yes | session default | `0c2bf2aee6280f6080ac29454ee5377d` |
| `public.ltree_addltree(ltree, ltree)` | no | yes | yes | session default | `ff0bbefde02ba7e09b202f56e8d05a93` |
| `public.ltree_addtext(ltree, text)` | no | yes | yes | session default | `31b69afbaec3d98c002980b3e05b31c0` |
| `public.ltree_cmp(ltree, ltree)` | no | yes | yes | session default | `e1490098353840c695d2e808bfb70b65` |
| `public.ltree_compress(internal)` | no | yes | yes | session default | `35bc9201b100516eb4682efb389393d0` |
| `public.ltree_consistent(internal, ltree, smallint, oid, internal)` | no | yes | yes | session default | `60f1d278020313e8373792708f9ba8c1` |
| `public.ltree_decompress(internal)` | no | yes | yes | session default | `6bbdcd3e5e33e25b77eeae71f4637952` |
| `public.ltree_eq(ltree, ltree)` | no | yes | yes | session default | `c49812f9a7f29d9cf258b84ea145a99c` |
| `public.ltree_ge(ltree, ltree)` | no | yes | yes | session default | `3ef4ce4950bb5903ad25a6692fe2b09d` |
| `public.ltree_gist_in(cstring)` | no | yes | yes | session default | `661dc614b1ebfe1ab17d822897e8fb62` |
| `public.ltree_gist_options(internal)` | no | yes | yes | session default | `905bc2f0b14762a5472a8614d74aef49` |
| `public.ltree_gist_out(ltree_gist)` | no | yes | yes | session default | `87660866dff7991ad007e675bf64c946` |
| `public.ltree_gt(ltree, ltree)` | no | yes | yes | session default | `99431b7e19101032d9ad249f24992b8a` |
| `public.ltree_in(cstring)` | no | yes | yes | session default | `5bd0bdf361c182747ceabebdf23e32a4` |
| `public.ltree_isparent(ltree, ltree)` | no | yes | yes | session default | `bc2c74dc21f99e627a9dd5cf17384afb` |
| `public.ltree_le(ltree, ltree)` | no | yes | yes | session default | `6fe8c77f2ce07d3a2a19ca656334d719` |
| `public.ltree_lt(ltree, ltree)` | no | yes | yes | session default | `3447cf03064ead3212b61b98232198ec` |
| `public.ltree_ne(ltree, ltree)` | no | yes | yes | session default | `9af1418859067cf5d0fa2be43cce5884` |
| `public.ltree_out(ltree)` | no | yes | yes | session default | `2f465556a614e218eca626988327a134` |
| `public.ltree_penalty(internal, internal, internal)` | no | yes | yes | session default | `7742a88152080bfbf4c34ac6983c6e2b` |
| `public.ltree_picksplit(internal, internal)` | no | yes | yes | session default | `1edcf761e1a5096a587172e1ddc3f687` |
| `public.ltree_recv(internal)` | no | yes | yes | session default | `1c411c9ce1b602817d65c6903e1cb3a8` |
| `public.ltree_risparent(ltree, ltree)` | no | yes | yes | session default | `921c276dba2feb50bf58b411a4832fa3` |
| `public.ltree_same(ltree_gist, ltree_gist, internal)` | no | yes | yes | session default | `4306a6c69a2fa1c2a8328396dd520fda` |
| `public.ltree_send(ltree)` | no | yes | yes | session default | `e153481332bafb61370453fc23c25ed2` |
| `public.ltree_textadd(text, ltree)` | no | yes | yes | session default | `b9cf5ef77ac38116d116e07197bae418` |
| `public.ltree_union(internal, internal)` | no | yes | yes | session default | `407598b6817bd2908d814b306f6b093c` |
| `public.ltreeparentsel(internal, oid, internal, integer)` | no | yes | yes | session default | `c19b35ac871de0b3eea932dcdd1a197e` |
| `public.ltxtq_exec(ltree, ltxtquery)` | no | yes | yes | session default | `0e823a95bc5c46ff89584084475c46b1` |
| `public.ltxtq_in(cstring)` | no | yes | yes | session default | `136c252fb601e49db25f1d87eb898ff9` |
| `public.ltxtq_out(ltxtquery)` | no | yes | yes | session default | `9442d737897bc0c36557fcc0b2468722` |
| `public.ltxtq_recv(internal)` | no | yes | yes | session default | `6a80f36080af11445a0c2310227e091a` |
| `public.ltxtq_rexec(ltxtquery, ltree)` | no | yes | yes | session default | `c0b59fe46be3f3b336647248aa56e866` |
| `public.ltxtq_send(ltxtquery)` | no | yes | yes | session default | `f8b627e795faecc7602e183e99ef6972` |
| `public.map_office_budget_account(p_section uuid, p_code text)` | no | no | yes | search_path="" | `96ec9a1f80c6d77a510e555e24d3dc5b` |
| `public.mark_petty_cash_released(p_release_id uuid)` | yes | no | yes | search_path=public | `18a1539726fc1d0bf35ec70bf02040db` |
| `public.materialize_due_task_templates()` | yes | no | yes | search_path=public | `f30523a48544efbd30fa36431f54420a` |
| `public.nlevel(ltree)` | no | yes | yes | session default | `cd9ae52ea9fd5ecf2fa3c29db6be326d` |
| `public.normalize_cash_request_reservation_window()` | yes | yes | yes | search_path=public | `88cdd66236098ba2e3b62ff3b3dedcbc` |
| `public.normalize_collaboration_activity_responsibility(input_snapshot jsonb)` | no | no | yes | search_path=public | `8beb9679b7fe736da5f13924f7576f34` |
| `public.normalize_collaboration_revision_task_teams()` | no | no | no | search_path=public | `bccdf34a6dcdb01a48c6aa223d855baf` |
| `public.normalize_collaboration_snapshot_roles(p_snapshot jsonb)` | no | no | yes | search_path=public | `12c5ec39996da6f480208187cacd4754` |
| `public.normalize_collaboration_task_teams(p_snapshot jsonb)` | no | no | yes | search_path=public | `a34ff14d1f5e511dfe1df5c71cf8c98c` |
| `public.normalize_collaboration_working_task_teams()` | no | no | no | search_path=public | `6fe6b9d11bb07c283a024b6609e4be09` |
| `public.notify_corrected_cash_request_reviewer()` | yes | yes | yes | search_path=public | `fc9685931754659ef65e4df9ec966dca` |
| `public.notify_department_accounting_settlement()` | yes | yes | yes | search_path=public | `0a2f0fcdf7b2e47bca9f4141f5e0e5bc` |
| `public.notify_subtask_progress_leader()` | yes | no | no | search_path=public | `ec7841ff86ba3dc192bd6591773e3af0` |
| `public.nw_work_command(p_root uuid, p_revision integer, p_request uuid, p_command text, p_payload jsonb, p_impact_fingerprint text)` | no | no | yes | search_path="" | `f266537b9d12cb1cf701e2f91e7a498a` |
| `public.nw_work_impact(p_root uuid, p_revision integer, p_command text, p_payload jsonb)` | no | no | yes | search_path="" | `0fb9de39614f49a83219b496768d7a07` |
| `public.org_in_my_subtree(target_org uuid, caller_id uuid)` | yes | yes | yes | search_path=public | `cbc9346e7a662d3e3c870b5f37b43424` |
| `public.organization_approver_ids(target_organization uuid)` | yes | no | yes | search_path=public | `3ce8bbedbe970c1f5ef31be949c60b6e` |
| `public.override_accounting_petty_cash_release_schedule(p_release_id uuid, p_reason text, p_release_method text, p_cheque_number text)` | yes | no | yes | search_path=public; TimeZone=Asia/Manila | `4a0c5ba40379376b9963193198247484` |
| `public.override_petty_cash_release_schedule(p_release_id uuid, p_reason text)` | yes | no | yes | search_path=public | `8666b3874f2fbf4ba993449e12ecbb5a` |
| `public.pdf_import_available_people(p_project uuid, p_actor uuid)` | yes | no | no | search_path="" | `e6ba305250d24ea992ec70af4317b53c` |
| `public.phase2_accept_invitation(p_hash text, p_user uuid, p_name text, p_claim uuid)` | yes | no | no | search_path="" | `521a4ce5be692328ab250f4ba1e79fb0` |
| `public.phase2_audit(p_actor uuid, p_office uuid, p_subject uuid, p_action text)` | yes | no | no | search_path="" | `56f9c48594d575d570e8dbcba569ae86` |
| `public.phase2_claim_invitation(p_hash text, p_claim uuid)` | yes | no | no | search_path="" | `401b1371448787b206ac330453d89f24` |
| `public.phase2_claim_pds_job()` | yes | no | no | search_path="" | `09a908651a6b9abe904a503942e11126` |
| `public.phase2_create_invitation(p_actor uuid, p_email text, p_role text, p_hash text, p_ttl integer)` | yes | no | no | search_path="" | `c61e11efb5385bbab7a806093d0a7442` |
| `public.phase2_identity_exists(p_email text)` | yes | no | no | search_path="" | `d45f4c3e5f7c520a1d303c8e84f071d8` |
| `public.phase2_invitation_conflict(p_email text, p_office uuid)` | yes | no | no | search_path="" | `471c5750bb82ccf3f102bab6ba02004c` |
| `public.phase2_is_office_head(p_user uuid, p_office uuid)` | yes | no | yes | search_path="" | `1b130abecc69f3003510c78a6c2b198f` |
| `public.phase2_manage_invitation(p_actor uuid, p_id uuid, p_action text, p_hash text, p_ttl integer)` | yes | no | no | search_path="" | `b89f80f1138bf589391c1de78065e486` |
| `public.phase2_profile_exists(p_email text)` | yes | no | no | search_path="" | `d2b9882e760188b2918dc7080028de56` |
| `public.phase2_reserve_invitation_email(p_id uuid, p_hash text)` | yes | no | no | search_path="" | `42292ac3c7b08817d1401bb57bb918e4` |
| `public.phase2_save_onboarding(p_user uuid, p_key text, p_patch jsonb)` | yes | no | no | search_path="" | `06c78f8c91d676f2e438cfc642ecd26c` |
| `public.phase3_audit_group()` | yes | no | no | search_path="" | `74f0eac1ec9a2476a535954628e99e1c` |
| `public.phase3_create_task(p_project_id uuid, p_group_id uuid, p_title text)` | no | no | yes | search_path="" | `5515b05d0c792a57d8f0bd9b27262ba7` |
| `public.phase3_default_project_group()` | yes | no | no | search_path="" | `0fdcad529e77c4c41df5dbcb7acfd63c` |
| `public.phase3_guard_group()` | no | no | no | search_path="" | `995658a594d3772d067d4bb9fe2e990a` |
| `public.phase3_guard_task_group()` | no | no | no | search_path="" | `86d1d441bb864a7a0c807b296548ff66` |
| `public.phase3_patch_task(p_task_id uuid, p_patch jsonb)` | no | no | yes | search_path="" | `7b3cf82618cbbdce9678adf2bc33c360` |
| `public.phase3_reorder_tasks(p_project_id uuid, p_group_id uuid, p_ids uuid[])` | no | no | yes | search_path="" | `c702fb6949d561c1ee68d38788fffed6` |
| `public.phase5_import_project_work(p_project_id uuid, p_request_id uuid, p_review jsonb)` | no | no | yes | search_path="" | `2ec226062af6b9f94dbb88e3b19cc8dd` |
| `public.phase65_create_invitation(p_actor uuid, p_identity uuid, p_email text, p_access text, p_hash text, p_ttl integer)` | yes | no | no | search_path="" | `7fe05010ac603fe6fdc10a5279baece6` |
| `public.phase65_import_project_work(p_project_id uuid, p_request_id uuid, p_review jsonb)` | yes | no | yes | search_path="" | `bca2bd9cdfe4b94908835033ed9d498e` |
| `public.phase65_link_office_identity(p_identity uuid, p_office uuid)` | yes | no | yes | search_path="" | `e018fb3cd08c5c63dcca601efeffe218` |
| `public.phase65_propose_task_office(p_task uuid, p_identity uuid)` | yes | no | yes | search_path="" | `cf2aedb624a8693f3f45dc5965499a8e` |
| `public.phase65_remove_project_office(p_participation uuid, p_identity uuid)` | no | no | yes | search_path="" | `e3c4cefbfc482ccd4b09f188e1d1a600` |
| `public.phase65_resolve_task_office(p_task uuid)` | yes | no | yes | search_path="" | `b72ea86afff76a023828085380b7b693` |
| `public.phase65_save_office_identity(p_project uuid, p_id uuid, p_name text, p_evidence text)` | yes | no | yes | search_path="" | `867b78dc029d8f7d5feaf02589eabab7` |
| `public.phase6_accept_invitation(p_hash text, p_user uuid, p_name text, p_claim uuid)` | yes | no | no | search_path="" | `5f6e3d4819f5ec752a474d8bd5f07321` |
| `public.phase6_confirm_office(p_id uuid)` | yes | no | yes | search_path="" | `5acce2a44ca489add4f5d135262945fb` |
| `public.phase6_create_invitation(p_actor uuid, p_project uuid, p_office uuid, p_email text, p_access text, p_hash text, p_ttl integer)` | yes | no | no | search_path="" | `09be111d134daf870cc9ea681508fd45` |
| `public.phase6_guard_project()` | yes | no | no | search_path="" | `49088caf3f5c5b5936d0a51371b2e4d3` |
| `public.phase6_guard_project_member()` | yes | no | no | search_path="" | `1fa891c19c4de7e8999ebdd67e120c13` |
| `public.phase6_guard_subtask()` | yes | no | no | search_path="" | `556e2a9d9afd26e0be10a4371fbc05d2` |
| `public.phase6_guard_task()` | yes | no | no | search_path="" | `62fa634b9501042f4844972ab90854e6` |
| `public.phase6_invitation_state()` | yes | no | no | search_path="" | `a88daf97436c9f707c705f192aa502b3` |
| `public.phase6_lead_office()` | yes | no | no | search_path="" | `0a4c5be64ebc2f5d942f289eb9414a74` |
| `public.phase6_move_task(p_task uuid, p_group uuid, p_position integer)` | yes | no | yes | search_path="" | `6ae864f8402dfcf26677e3bdf9e71931` |
| `public.phase6_responsible_office(p_task uuid, p_office uuid)` | yes | no | yes | search_path="" | `a984336767377511527039637e7e5985` |
| `public.phase6_set_members(p_id uuid, p_users uuid[])` | yes | no | yes | search_path="" | `d1bf3fce135aca9aea0a0df6c7fb7115` |
| `public.phase6_withdraw_office_invitation(p_id uuid)` | yes | no | yes | search_path="" | `375a9e742fee91138376fcd5e32c65c3` |
| `public.phase7_activate_project(p_project uuid)` | yes | no | yes | search_path="" | `8d9592f1184727f90c270393ae8c19cd` |
| `public.phase7_closeout_summary(p_project uuid)` | yes | no | yes | search_path="" | `2830265f4e0f5b8d4ac60f2188d31006` |
| `public.phase7_project_readiness(p_project uuid)` | yes | no | yes | search_path="" | `61f6f523b8b543ff7e695272fddee577` |
| `public.phase7_review_project(p_project uuid, p_kind text)` | yes | no | yes | search_path="" | `0939c0e8ec8543927fb4dc6cf11e0b64` |
| `public.post_cash_release_general_journal()` | yes | yes | yes | search_path=public; TimeZone=Asia/Manila | `13add406427fc756c6e1bb5517b5459a` |
| `public.post_general_journal_adjustment(p_fiscal_budget_id uuid, p_entry_date date, p_reference_number text, p_memo text, p_lines jsonb)` | yes | no | yes | search_path="" | `51dc03e86e9679205cb9dc6a78fcf0c6` |
| `public.post_liquidation_general_journal()` | yes | no | no | search_path=""; TimeZone=Asia/Manila | `2567decd672fa10fb8a2de94ec649fa7` |
| `public.prevent_accounting_record_mutation()` | yes | yes | yes | search_path=public | `6d36e1864fdf88c43c4665dfd38017a6` |
| `public.prevent_budget_ledger_mutation()` | yes | yes | yes | search_path=public | `3d14407937574c187d30b8686ed7e387` |
| `public.prevent_self_privilege_escalation()` | yes | yes | yes | session default | `01921a33e9825f8992fade463c075799` |
| `public.project_ai_available_people(p_root uuid, p_actor uuid)` | yes | no | no | search_path="" | `7a858799d1814271f95319b074ea2acd` |
| `public.project_completion_readiness_internal(p_project_id uuid)` | yes | no | no | search_path="" | `1066443f95cdec9826e791e496a3d0ec` |
| `public.publish_department_proposal(p_draft_id uuid)` | yes | no | yes | search_path=public | `9e245ae21141a586c580bfd6de705283` |
| `public.publish_project(p_project uuid)` | yes | no | yes | search_path="" | `37887402ffe0af0826885e9fb3478d88` |
| `public.r11_project_activity(p_project uuid, p_snapshot uuid, p_page integer, p_size integer, p_kind text, p_search text, p_from timestamp with time zone, p_to timestamp with time zone)` | no | no | yes | search_path="" | `5bf6ec58da969c0090b9d93b4ec9280d` |
| `public.r12_save_presentation_settings(p_request uuid, p_expected jsonb, p_values jsonb)` | no | no | yes | search_path="" | `c3b43f86bd0575ca08aa60824c6feb8c` |
| `public.r3_create_personal_project(p_workspace uuid, p_request uuid, p_title text)` | yes | yes | yes | search_path="" | `4e869d7e9a0e6de66ed9b358029c5a41` |
| `public.r3_create_workspace(p_request uuid, p_name text, p_timezone text)` | yes | yes | yes | search_path="" | `8ceaf75b77875e6e75c12452a8e9b387` |
| `public.r3_list_workspaces()` | yes | yes | yes | search_path="" | `8173e9dd5f961766f58bf50a18428c04` |
| `public.r3_personal_member_candidates(p_project uuid)` | yes | yes | yes | search_path="" | `f1b503ea39ab2fdaf0e47d0b12b298bb` |
| `public.r3_personal_project_command(p_project uuid, p_command text, p_payload jsonb, p_request uuid)` | yes | yes | yes | search_path="" | `aa9bccc4c755ee3bbf4907f1978049e0` |
| `public.r3_personal_project_snapshot(p_project uuid)` | yes | yes | yes | search_path="" | `5553a0b107db468f5edeb6da89e62a75` |
| `public.r3_select_workspace(p_workspace uuid)` | yes | yes | yes | search_path="" | `83ce7f11cad3115f553b3f4adfc124b7` |
| `public.r6_list_project_files(p_project uuid, p_task uuid)` | no | no | yes | search_path="" | `05dad30155a9be29d0c4fcc10d44fb41` |
| `public.r6_project_file_command(p_project uuid, p_task uuid, p_command text, p_payload jsonb)` | no | no | yes | search_path="" | `f23933f029eb82c19eefe5196a386b43` |
| `public.r7_member_terms(p_project uuid, p_user uuid, p_office uuid, p_engagement text, p_end timestamp with time zone, p_until_close boolean, p_expected jsonb, p_request uuid)` | no | no | yes | search_path="" | `7f13b624662d2cd96f343f5cd8bf876b` |
| `public.r7_office_work_roots()` | no | no | yes | search_path="" | `800c2f17de511ad1397905e85dc8b80c` |
| `public.r7_pending_subtask_reviews()` | no | no | yes | search_path="" | `9190e42c2501e17c6b57204bc84483d4` |
| `public.r7_personal_work_roots(p_project uuid)` | no | no | yes | search_path="" | `126e3ef7081b3d1adaa51f117bf28999` |
| `public.r7_project_members(p_project uuid)` | no | no | yes | search_path="" | `80ae09f162ebeb78a460f6a54402d8d8` |
| `public.r7_select_office_members(p_office uuid, p_expected uuid[], p_users uuid[], p_request uuid)` | no | no | yes | search_path="" | `63b94768746fcc5e6676c04c051902ca` |
| `public.r7_work_activity(p_roots uuid[], p_before timestamp with time zone, p_id uuid)` | no | no | yes | search_path="" | `1c882e9a32338cd05b66890c04170a7a` |
| `public.r7_work_command(p_root uuid, p_revision integer, p_request uuid, p_command text, p_payload jsonb)` | no | no | yes | search_path="" | `810d27e549342f0e75ad564e93a7ba55` |
| `public.r7_work_tree(p_root uuid)` | no | no | yes | search_path="" | `7aa418f79e8672cd4f072902ea6b3e78` |
| `public.r8_accept(p_hash text, p_user uuid, p_name text, p_claim uuid)` | yes | no | no | search_path="" | `5c29b6d309a0cc778d6a345567a8b7fb` |
| `public.r8_complete_onboarding(p_id uuid)` | no | no | yes | search_path="" | `34633181d7aa05e27316517fc9936489` |
| `public.r8_decide_request(p_id uuid, p_revision integer, p_action text)` | no | no | yes | search_path="" | `3e3c2b7565bff5a40c31957350d40ed4` |
| `public.r8_designate_sponsor(p_workspace uuid, p_office uuid)` | no | no | yes | search_path="" | `8d82941987b78f1b6da781fd13f26cc6` |
| `public.r8_finish_dispatch(p_id uuid, p_hash text, p_provider text, p_error text)` | yes | no | no | search_path="" | `bb9c9147bd3c5016a60ca257ee88a13f` |
| `public.r8_head_invitation_queue()` | no | no | yes | search_path="" | `b7c479b66f91083a0bf682a5634dab2f` |
| `public.r8_list_requests(p_project uuid)` | no | no | yes | search_path="" | `e3d85b21156e12855b4d2bedf9a054d5` |
| `public.r8_lookup(p_hash text, p_claim uuid)` | yes | no | no | search_path="" | `f87de88880b99294d86e2dbc79537d23` |
| `public.r8_pds_context(p_actor uuid, p_id uuid)` | yes | no | no | search_path="" | `f2467a663d65a9606bc89075ff9b2b59` |
| `public.r8_reserve_dispatch(p_actor uuid, p_id uuid, p_revision integer, p_hash text, p_ttl integer, p_resend boolean)` | yes | no | no | search_path="" | `5afadc289af2014128ece2a4dfbf6aa0` |
| `public.r8_submit_request(p_id uuid, p_project uuid, p_root uuid, p_node uuid, p_office uuid, p_email text, p_summary text, p_skills text[], p_engagement text, p_end timestamp with time zone, p_close boolean)` | no | no | yes | search_path="" | `d02d6c9117fe623cb7a5f0be033bee3d` |
| `public.r9_grant_access(p_id uuid, p_project uuid, p_email text, p_access text, p_engagement text, p_end timestamp with time zone, p_close boolean, p_ttl integer)` | no | no | yes | search_path="" | `766fc8de2ffd0a2386f080991cd39c2e` |
| `public.r9_member_terms(p_project uuid, p_user uuid, p_office uuid, p_engagement text, p_end timestamp with time zone, p_until_close boolean, p_expected jsonb, p_request uuid)` | no | no | yes | search_path="" | `831d8e3c7329b78360588aacc9ac747b` |
| `public.r9_open_share(p_id uuid)` | no | no | yes | search_path="" | `22c90f2c6153141646c1e0d6d2ce22e6` |
| `public.r9_project_access(p_project uuid)` | no | no | yes | search_path="" | `d91125d99c5144a5a16e35c5845df79c` |
| `public.r9_removal_preview(p_project uuid, p_user uuid, p_office uuid)` | no | no | yes | search_path="" | `631f588f275a6d2974af92bf4300ce52` |
| `public.r9_remove_person(p_project uuid, p_user uuid, p_office uuid, p_fingerprint text, p_request uuid)` | no | no | yes | search_path="" | `b841482d4858514a75bc522fc82e8d4e` |
| `public.r9_revoke_grant(p_id uuid)` | no | no | yes | search_path="" | `f812bc9c040d9e998395c1c6576ef7a9` |
| `public.r9_select_members(p_office uuid, p_users uuid[], p_fingerprint text, p_request uuid)` | no | no | yes | search_path="" | `3f6ce0f658ca95c6ad298678f50e9cfd` |
| `public.r9_selection_preview(p_office uuid, p_users uuid[])` | no | no | yes | search_path="" | `a1f31b43145faf9ef0e5505b8e6a98d3` |
| `public.recalculate_monthly_productivity(p_month_start date, p_reason text)` | yes | no | yes | search_path=public | `e65cdd71a27300d37461b5743b9198dd` |
| `public.record_accounting_petty_cash_release(p_release_id uuid, p_release_method text, p_cheque_number text)` | yes | no | yes | search_path=public; TimeZone=Asia/Manila | `e789a0f3251157f526b97077c2e2aa27` |
| `public.record_initial_task_lifecycle()` | yes | yes | yes | search_path=public | `70fcee8ac59092a89c81c0f6ed375c63` |
| `public.record_petty_cash_release_internal(p_release_id uuid, p_override_reason text)` | yes | no | no | search_path=public; TimeZone=Asia/Manila | `6dbecd3631c9f782c949da03d032fd19` |
| `public.recuse_and_delegate_collaboration_review(p_draft_id uuid, p_organization_id uuid, p_reason text, p_delegate_to uuid, p_valid_until timestamp with time zone)` | yes | no | yes | search_path=public | `c7f4795d0c65be083953dff8b533f386` |
| `public.refresh_collaboration_readiness(target_draft uuid)` | yes | no | yes | search_path=public | `26275100820935a4b97f6514cef19aa5` |
| `public.refresh_task_subtask_rollup(target_task uuid, touch_activity boolean)` | yes | no | no | search_path="" | `cd955c20710c5e7c0949943d5c2fa975` |
| `public.remove_subtask_budget_cap(p_cap_allocation_id uuid, p_reason text, p_idempotency_key uuid)` | yes | no | yes | search_path=public | `838ca8a8ea80c63cc035c609f26775e3` |
| `public.reorder_task_subtasks(p_task_id uuid, p_ordered_ids uuid[])` | yes | no | yes | search_path=public | `8e480c6c7af4d9fc1a4c204cb95d1a00` |
| `public.request_collaboration_review(p_draft_id uuid)` | yes | no | yes | search_path=public | `0f402f1782da8da64ff5ecbfd93ee6e3` |
| `public.request_proposal_closeout(p_draft_id uuid, p_note text)` | yes | no | yes | search_path=public | `46e775d8fca008ccd3ad85b1f76aa386` |
| `public.resolve_collaboration_change_request(p_request_id uuid, p_status text, p_reason text)` | yes | no | yes | search_path=public | `a311fbf3dbf426f95a3a95d04e28f061` |
| `public.resolve_subtask_reviewer(target_task tasks, submitter uuid)` | yes | no | yes | search_path=pg_catalog | `5b5c7cef8e343623d292f5922742e157` |
| `public.resubmit_contextual_cash_request(p_request_id uuid, p_allocation_line_id uuid, p_amount numeric, p_purpose text, p_needed_by date)` | yes | no | yes | search_path="" | `3237ad75e59c587b109b9821fa020bc0` |
| `public.resubmit_petty_cash_request(p_request_id uuid, p_amount numeric, p_purpose text, p_needed_by date)` | yes | yes | yes | search_path=public | `4dd3eac934330e312aa486170e3f749e` |
| `public.review_subtask_template(p_template_id uuid, p_approve boolean)` | yes | no | yes | search_path=public | `e78aec00170dee67edca0065febf0a39` |
| `public.rls_auto_enable()` | yes | yes | yes | search_path=pg_catalog | `6998ea6b4c2480f5d2e34b5dcf3f8d36` |
| `public.rollup_task_subtasks()` | yes | no | no | search_path=public | `e6ebba1468d668cb0021d39af023e019` |
| `public.route_organization_leadership_review()` | no | yes | yes | search_path=public | `6958ff5f66135b7a8bfa70b9a08f1949` |
| `public.run_department_budget_maintenance()` | yes | yes | yes | search_path=public | `58d79189b4e5bbd5a9e13f60073ae5a3` |
| `public.run_governance_review_escalations()` | yes | no | yes | search_path=public | `a895565a4b23daad2a54ee518c9f8ac4` |
| `public.save_collaboration_revision(p_draft_id uuid, p_snapshot jsonb, p_change_summary text)` | yes | no | yes | search_path=public | `62f1f9c863f0de98c3b20f490d8d83d3` |
| `public.save_collaboration_staffing_revision(p_draft_id uuid, p_organization_id uuid, p_snapshot jsonb, p_change_summary text)` | yes | no | yes | search_path=public | `4698d10d4a6c702c5db0a4a2b489f496` |
| `public.save_department_fiscal_budget(p_org_id uuid, p_fiscal_year integer, p_petty_cash_limit numeric, p_request_limit numeric, p_underutilization_threshold numeric, p_notes text, p_lines jsonb)` | yes | yes | yes | search_path=public | `90f5a606cbb5408a8ef8c4378171e2d9` |
| `public.save_department_fiscal_budget_v2(p_org_id uuid, p_fiscal_year integer, p_daily_release_limit numeric, p_per_receipt_limit numeric, p_liquidation_due_days integer, p_allow_receipt_limit_override boolean, p_underutilization_threshold numeric, p_notes text, p_lines jsonb)` | yes | yes | yes | search_path=public | `cf326bfb93198725e15ea895618405eb` |
| `public.save_office_budget_sections(p_org_id uuid, p_fiscal_year integer, p_sections jsonb, p_expected_version integer, p_reason text, p_settings jsonb)` | no | no | yes | search_path="" | `33deb685660b356ab78ec1fa50b81993` |
| `public.save_pdf_import_session(p_id uuid, p_project uuid, p_revision integer, p_runner uuid, p_state jsonb)` | yes | no | yes | search_path="" | `3ab6e8a0cc6a1f021ccbc6c58bcaacbc` |
| `public.save_proposal_governance_record(p_draft_id uuid, p_organization_id uuid, p_resolution_number text, p_meeting_date date, p_minutes_file_name text, p_minutes_file_path text, p_endorsement text)` | yes | no | yes | search_path=public | `193a1cd4b6c3da2c8d661afbd90d8a6a` |
| `public.save_subtask_progress(p_subtask_id uuid, p_percent_complete integer, p_blocker_category text, p_blocker text, p_next_step text, p_note text, p_attachment_path text, p_attachment_name text)` | yes | no | yes | search_path=public | `9e853f5b3b259c2d60da2c87e574f5af` |
| `public.save_subtask_template(p_template_id uuid, p_payload jsonb)` | yes | no | yes | search_path=public | `a4f929a531ced818c98520fbc091fae3` |
| `public.save_subtask_work_update(p_subtask_id uuid, p_state text, p_blocker text, p_note text, p_next_step text, p_attachment_path text, p_attachment_name text)` | yes | no | yes | search_path=public | `cb68b79d94da763d7ddaa71480af3f2c` |
| `public.schedule_petty_cash_releases(p_request_id uuid, p_actor uuid)` | yes | yes | yes | search_path=public; TimeZone=Asia/Manila | `97592b48a46180472fca48b7f2494aee` |
| `public.send_collaboration_message(p_draft_id uuid, p_message text, p_target_type text, p_target_key text, p_message_type text)` | yes | no | yes | search_path=public | `94002ded5c0b02fdc57be39d2a9ce2d8` |
| `public.set_collaboration_organizations(p_draft_id uuid, p_organizations jsonb, p_snapshot jsonb, p_change_summary text)` | yes | no | yes | search_path=public | `7771bfe6f06a45b97549d76d9b487b14` |
| `public.set_collaboration_source_document(p_draft_id uuid, p_source_file_name text, p_source_file_path text, p_source_file_hash text)` | yes | no | yes | search_path=public | `97e121cc936dfb7107d03034327ffe8a` |
| `public.set_department_accounting_staff(p_user_id uuid, p_assigned boolean)` | yes | no | yes | search_path=public | `0adca1c62157455105ab1836f4b6c48c` |
| `public.set_organization_approvers(p_organization_id uuid, p_primary_approver_id uuid, p_backup_approver_id uuid)` | yes | no | yes | search_path=public | `f7eb6a987947b71cfbdafc34d0c55a1f` |
| `public.set_organization_leadership(p_org_id uuid, p_head_user_id uuid, p_assistant_head_user_id uuid)` | yes | no | yes | search_path=public | `c4e08e7cd1ef08bfd2847d6a182b0263` |
| `public.set_organization_membership(p_organization_id uuid, p_user_id uuid, p_membership_role text, p_reason text)` | yes | no | yes | search_path=public | `7f7600a4339b42dafd5e862d7d3665cc` |
| `public.set_proposal_governance_configuration(p_draft_id uuid, p_organizations jsonb, p_assignments jsonb)` | yes | no | yes | search_path=public | `1f2f88eb2dbe9279e34770c48724f937` |
| `public.set_subtask_budget_cap(p_task_id uuid, p_subtask_id uuid, p_parent_allocation_line_id uuid, p_amount numeric, p_reason text, p_idempotency_key uuid)` | yes | no | yes | search_path=public | `7701ba36e6ef441c5630888ab0ccdeb4` |
| `public.set_subtask_due_date(p_subtask_id uuid, p_due_date date, p_reason text)` | yes | no | yes | search_path=public | `c23d24a81285853162c4e72951ceb568` |
| `public.set_task_archived(p_task_id uuid, p_archived boolean)` | yes | no | yes | search_path=public | `2d48e266694c17c295e44e19f3a10251` |
| `public.set_user_preferences_updated_at()` | no | yes | yes | session default | `20451d7695db131a4a74e0384eae8102` |
| `public.settle_accounting_liquidation(p_liquidation_id uuid, p_approve boolean, p_reason text)` | yes | no | yes | search_path=public | `39e00471331256659530f82cadbed94f` |
| `public.soft_delete_collaboration_draft(p_draft_id uuid, p_reason text)` | yes | no | yes | search_path=public | `72e730fc9a76d4c5b7dd14a91c2f0f6e` |
| `public.soft_delete_task(p_task_id uuid)` | yes | no | yes | search_path=public | `520c3a091982ba6a1a042866c5ee35b6` |
| `public.subltree(ltree, integer, integer)` | no | yes | yes | session default | `15072174e404bdf1759b4836ee6c7d52` |
| `public.submit_accounting_cash_liquidation(p_request_id uuid, p_declared_spent numeric, p_note text, p_receipts jsonb, p_idempotency_key uuid, p_refund_receipt_number text, p_refund_date date)` | yes | no | yes | search_path="" | `db57cf74fd50ab7c35992fa0e91c4d5e` |
| `public.submit_contextual_cash_liquidation(p_request_id uuid, p_declared_spent numeric, p_note text, p_receipts jsonb, p_idempotency_key uuid)` | yes | no | yes | search_path="" | `c34a386a28ce0c2a0532c0ad87897532` |
| `public.submit_itemized_cash_liquidation(p_request uuid, p_spent numeric, p_note text, p_receipts jsonb, p_key uuid, p_refund_number text, p_refund_date date)` | no | no | yes | search_path="" | `ea6c3f260e30c15f65d90ad65fbb5d5d` |
| `public.submit_petty_cash_liquidation(p_request_id uuid, p_declared_spent numeric, p_note text, p_receipts jsonb)` | yes | yes | yes | search_path=public | `b1c76c8dd0116df676b73bec4a7df184` |
| `public.submit_subtask_for_review(p_subtask_id uuid, p_submission jsonb)` | yes | no | yes | search_path=public | `093faca74f537724bc8aee64bfed042e` |
| `public.submit_task_for_review(p_task_id uuid, p_submission jsonb)` | yes | no | yes | search_path=public | `8461b3c562e8774efc45519c2dca8043` |
| `public.submit_task_progress(p_task_id uuid, p_percent_complete integer, p_blocker_category text, p_blocker text, p_next_step text, p_note text, p_attachment_path text, p_attachment_name text)` | yes | no | yes | search_path=public | `76228a008747c2623eac741f23f7f102` |
| `public.subpath(ltree, integer)` | no | yes | yes | session default | `3a92fae434f97b214668a75c80840517` |
| `public.subpath(ltree, integer, integer)` | no | yes | yes | session default | `5a4ecf9db70d9e73e60ff2eb3d8650dc` |
| `public.subtask_cap_available(p_cap_allocation_id uuid, p_exclude_request_id uuid)` | yes | no | yes | search_path=public | `28c2a19e73a33667bc2584cfa3399935` |
| `public.sync_petty_cash_request_organizations()` | yes | yes | yes | search_path=public | `2c74c7d531f3e3250df2b0ee2291ac60` |
| `public.sync_task_chat_channel()` | yes | no | no | search_path=public | `2ea7db83d51f2c5f5194421525332082` |
| `public.sync_task_subtask_counts()` | no | yes | yes | session default | `d208eda73d287a5067e081d9f5458649` |
| `public.task_budget_line_available(p_allocation_line_id uuid, p_exclude_request_id uuid)` | yes | no | yes | search_path="" | `1c789f3d0810720ed9db0bcf6e945e03` |
| `public.text2ltree(text)` | no | yes | yes | session default | `4de4be8d840869dbbd26f769134bf9e2` |
| `public.touch_pdf_import_session(p_id uuid, p_runner uuid, p_release boolean)` | yes | no | yes | search_path="" | `6b62d36e0ab2c0e5aa654af84a0ee669` |
| `public.touch_updated_at()` | no | yes | yes | session default | `9b141f76ab14a924a4f7353b3128d507` |
| `public.transition_task_status(p_task_id uuid, p_to_status text, p_feedback text, p_reason text)` | yes | yes | yes | search_path=public | `4266c0e43b90b8c862b1c67d273a11c2` |
| `public.update_project_metadata(p_project_id uuid, p_expected_updated_at timestamp with time zone, p_changes jsonb)` | no | no | yes | search_path="" | `081ceb40f111ffcc5171df7f7434f517` |
| `public.update_updated_at()` | no | yes | yes | session default | `23c037f1bbeb5c4fb767af7f39c6703d` |
| `public.validate_cash_request_needed_by()` | yes | no | no | search_path=public | `8b657de3c4f6c3778e0d1c0c803728cc` |
| `public.validate_task_reviewers()` | no | yes | yes | search_path=public | `58a401062849605e67dfbc634b0ed778` |

