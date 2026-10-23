#!/usr/bin/env python3
"""validate_hr_layer.py — TopTechHR
Checks that every pointer in hr-layer/ resolves to a record in the Key Personnel content pack,
that every lever and gate has exactly one HR-layer entry, and that the HR layer carries no citations
or figures of its own. Exit 1 on any error.

usage: python3 tools/validate_hr_layer.py <hr-layer dir> <key-personnel content-pack dir>
"""
import os, re, sys, yaml

def load(p):
    with open(p, encoding='utf-8') as f:
        return yaml.safe_load(f)

def main(hr, pack):
    errs = []
    E = errs.append
    P = lambda *a: os.path.join(pack, *a)
    H = lambda *a: os.path.join(hr, *a)

    levers = {l['id'] for l in load(P('levers.yaml'))}
    gates = {g['id'] for g in load(P('gates.yaml'))}
    patterns = {p['id'] for p in load(P('patterns.yaml'))}
    stages = {s['id'] for s in load(P('stages.yaml'))}
    states = {s['id'] for s in load(P('states.yaml'))}
    glossary = {t['id'] for t in load(P('glossary.yaml'))}
    pf = load(P('pathfinder.yaml'))
    pf_tags = {q['id']: {o.get('tag') for o in q['options']} for q in pf['questions']}

    # situations.yaml
    s = load(H('situations.yaml'))
    for step in s['steps']:
        m = step.get('maps_to')
        if m == 'stage':
            for o in step['options']:
                for st in o.get('stages', []) + ([o['tag']] if o.get('tag') else []):
                    if st not in stages: E(f"situations/{step['id']}: stage {st!r} not in stages.yaml")
                if 'tag' in o and o['tag'] is not None and o['tag'] not in pf_tags['stage']: E(f"situations/{step['id']}: tag {o['tag']!r} not a pathfinder stage option")
        elif m == 'pattern':
            for o in step['options']:
                if o['tag'] not in patterns: E(f"situations/pattern: {o['tag']!r} not in patterns.yaml")
                if o['tag'] not in pf_tags['pattern']: E(f"situations/pattern: {o['tag']!r} not a pathfinder option")
            if {o['tag'] for o in step['options']} != pf_tags['pattern']: E("situations/pattern: option set differs from pathfinder.yaml")
        elif m == 'conditions':
            for o in step['options']:
                if o['tag'] not in pf_tags['conditions']: E(f"situations/conditions: {o['tag']!r} not a pathfinder condition")
            if {o['tag'] for o in step['options']} != pf_tags['conditions']: E("situations/conditions: option set differs from pathfinder.yaml")
        elif m == 'state':
            if step.get('default') and step['default'] not in states: E(f"situations/state: default {step['default']!r} not in states.yaml")

    # actions.yaml
    a = load(H('actions.yaml'))
    seen = [x['lever'] for x in a['actions']]
    for x in a['actions']:
        if x['lever'] not in levers: E(f"actions: lever {x['lever']!r} not in levers.yaml")
        if x['moment'] not in a['moments']: E(f"actions/{x['lever']}: moment {x['moment']!r} not declared")
        if not x.get('plain_name'): E(f"actions/{x['lever']}: no plain_name")
        for m in x.get('also', []):
            if m not in a['moments']: E(f"actions/{x['lever']}: also {m!r} not declared")
    lever_stages = {l['id']: l.get('stages') or [] for l in load(P('levers.yaml'))}
    for x in a['actions']:
        st = lever_stages.get(x['lever']) or []
        if st and x.get('stage') != st[0]: E(f"actions/{x['lever']}: stage {x.get('stage')!r} is not the lever's first stage {st[0]!r}")
    for l in sorted(levers - set(seen)): E(f"actions: lever {l} has no entry")
    for l in sorted({x for x in seen if seen.count(x) > 1}): E(f"actions: lever {l} listed more than once")

    # rules.yaml
    r = load(H('rules.yaml'))
    seen = [x['gate'] for x in r['rules']]
    for x in r['rules']:
        if x['gate'] not in gates: E(f"rules: gate {x['gate']!r} not in gates.yaml")
        if x['moment'] not in r['moments']: E(f"rules/{x['gate']}: moment {x['moment']!r} not declared")
        for m in x.get('also', []):
            if m not in r['moments']: E(f"rules/{x['gate']}: also {m!r} not declared")
    for g in sorted(gates - set(seen)): E(f"rules: gate {g} has no entry")

    # glossary-aliases.yaml
    ga = load(H('glossary-aliases.yaml'))
    for x in ga['aliases']:
        if x['term'] not in glossary: E(f"glossary-aliases: {x['alias']!r} -> {x['term']!r} not in glossary.yaml")

    # plan-template.yaml
    t = load(H('plan-template.yaml'))
    ids = [sec['id'] for sec in t['sections']]
    for need in ('situation', 'confirmed', 'actions', 'rules', 'numbers', 'sources'):
        if need not in ids: E(f"plan-template: section {need!r} missing")

    # no facts of its own: no [n] citations, no percentages or dollar figures in HR-layer text
    for fn in ('situations.yaml', 'actions.yaml', 'rules.yaml', 'plan-template.yaml', 'glossary-aliases.yaml'):
        txt = open(H(fn), encoding='utf-8').read()
        if re.search(r'\[\d+\]', txt): E(f"{fn}: carries a [n] citation — the HR layer never cites; facts live in the pack")
        if re.search(r'\d+(\.\d+)?\s?%|\$\s?\d', txt): E(f"{fn}: carries a figure — the HR layer never states a number")

    for e in errs: print('ERROR', e)
    print(f"{len(errs)} errors")
    return 1 if errs else 0

if __name__ == '__main__':
    sys.exit(main(sys.argv[1], sys.argv[2]))
