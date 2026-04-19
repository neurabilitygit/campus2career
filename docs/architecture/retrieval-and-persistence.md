# Retrieval and Persistence for Briefs and Chat

## Retrieval layer
The API now includes retrieval scaffolding for:
- student profile
- parent-visible insights
- upcoming deadlines
- recent accomplishments

## Brief persistence
Parent briefs are now persisted into `parent_monthly_briefs` through the brief orchestrator.

## Chat retrieval
Scenario chat now pulls visible insights and target-goal context before sending the prompt to the model.

## Remaining gap
Replace demo student IDs with real authenticated student resolution and add real scoring inputs from persisted market and student data.
