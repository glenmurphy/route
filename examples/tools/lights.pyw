import urllib2, sys
urllib2.urlopen("http://10.0.1.41:8000/event/%s" % sys.argv[1])